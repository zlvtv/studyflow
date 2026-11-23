"""Contract checks for release scripts with a fake Docker CLI, not container tests."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FAKE_DOCKER = r"""#!/usr/bin/env bash
set -eu
printf '%s %s\n' "$APP_TAG" "$*" >> "$FAKE_LOG"
case "$*" in
  *'exec -T db'*)
    [ "${FAIL_BACKUP:-}" != 1 ] || exit 1
    printf 'backup'
    ;;
  *'run --rm --no-deps backend alembic upgrade head'*)
    [ "${FAIL_MIGRATION:-}" != 1 ] || exit 1
    ;;
  *'up -d --no-build --wait'*)
    [ "$APP_TAG" != "${FAIL_TAG:-}" ] || exit 1
    ;;
  *'port frontend 80'*) printf '127.0.0.1:8088\n' ;;
esac
"""
FAKE_CURL = r"""#!/usr/bin/env bash
[ "$APP_TAG" != "${FAIL_HTTP_TAG:-}" ] || exit 22
case "$*" in
  *'/health'*) printf '{"status":"ok","version":"%s"}' "${HEALTH_VERSION:-$APP_TAG}";;
esac
"""


class DeploymentScripts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name)
        self.bin = self.state / "bin"
        self.bin.mkdir()
        for name, script in (("docker", FAKE_DOCKER), ("curl", FAKE_CURL)):
            file = self.bin / name
            file.write_text(script)
            file.chmod(0o700)
        (self.state / ".env").write_text("POSTGRES_PASSWORD=test-only\n")
        self.env = {
            **os.environ,
            "PATH": f"{self.bin}:{os.environ['PATH']}",
            "STUDYFLOW_DEPLOY_DIR": str(self.state),
            "FAKE_LOG": str(self.state / "commands.log"),
        }

    def run_script(self, script="deploy", tag="v2", **env):
        return subprocess.run(
            ["bash", str(ROOT / "infra" / f"{script}.sh"), tag],
            env={**self.env, **env},
            capture_output=True,
            text=True,
            timeout=10,
        )

    def previous(self):
        (self.state / "current-tag").write_text("v1\n")

    def test_success_backs_up_before_migrating_and_tracks_versions(self):
        self.previous()
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.state / "current-tag").read_text().strip(), "v2")
        self.assertEqual((self.state / "previous-tag").read_text().strip(), "v1")
        log = (self.state / "commands.log").read_text()
        self.assertLess(log.index("exec -T db"), log.index("alembic upgrade head"))
        self.assertFalse((self.state / "deploy.lock").exists())
        self.assertEqual(len(list((self.state / "backups").glob("*.dump"))), 1)

    def test_unhealthy_release_restores_previous_images_and_fails_job(self):
        self.previous()
        result = self.run_script(FAIL_TAG="v2")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.state / "current-tag").read_text().strip(), "v1")
        self.assertIn("v1 compose", (self.state / "commands.log").read_text())
        self.assertFalse((self.state / "deploy.lock").exists())

    def test_migration_failure_does_not_publish_new_version(self):
        self.previous()
        result = self.run_script(FAIL_MIGRATION="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.state / "current-tag").read_text().strip(), "v1")
        self.assertNotIn(
            "v2 compose --env-file "
            + str(self.state / ".env")
            + " -f "
            + str(ROOT / "compose.yaml")
            + " up -d --no-build",
            (self.state / "commands.log").read_text(),
        )

    def test_first_failure_does_not_invent_previous_release(self):
        result = self.run_script(FAIL_TAG="v2")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.state / "current-tag").exists())

    def test_failed_backup_prevents_migration(self):
        result = self.run_script(FAIL_BACKUP="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("alembic", (self.state / "commands.log").read_text())
        self.assertFalse((self.state / "deploy.lock").exists())

    def test_invalid_tag_rejected(self):
        result = self.run_script(tag="v2;touch ignored")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.state / "commands.log").exists())

    def test_lock_protects_existing_maintenance(self):
        (self.state / "deploy.lock").mkdir()
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((self.state / "deploy.lock").exists())

    def test_manual_rollback_switches_version_records(self):
        (self.state / "current-tag").write_text("v2\n")
        result = self.run_script(script="rollback", tag="v1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.state / "current-tag").read_text().strip(), "v1")
        self.assertEqual((self.state / "previous-tag").read_text().strip(), "v2")

    def test_rollback_to_current_version_keeps_previous_version(self):
        (self.state / "current-tag").write_text("v2\n")
        (self.state / "previous-tag").write_text("v1\n")
        result = self.run_script(script="rollback", tag="v2")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.state / "previous-tag").read_text().strip(), "v1")
        self.assertFalse((self.state / "commands.log").exists())

    def test_old_health_version_prevents_publishing_new_tag(self):
        self.previous()
        result = self.run_script(HEALTH_VERSION="v1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.state / "current-tag").read_text().strip(), "v1")
        self.assertIn("Previous images restored: v1", result.stderr)

    def test_failed_recovery_is_reported_as_failure(self):
        self.previous()
        result = self.run_script(FAIL_HTTP_TAG="v2", FAIL_TAG="v1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("could not be restored", result.stderr)
        self.assertNotIn("Previous images restored:", result.stderr)
        self.assertEqual((self.state / "current-tag").read_text().strip(), "v1")

    def test_backup_files_are_private(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        backup = next((self.state / "backups").glob("*.dump"))
        self.assertEqual(backup.stat().st_mode & 0o777, 0o600)

    def test_invalid_timeout_is_rejected_before_docker(self):
        result = self.run_script(STUDYFLOW_WAIT_SECONDS="unlimited")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.state / "commands.log").exists())


if __name__ == "__main__":
    unittest.main()
