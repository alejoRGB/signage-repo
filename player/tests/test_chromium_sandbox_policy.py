import player


def test_chromium_sandbox_policy_defaults_to_sandbox(monkeypatch):
    monkeypatch.delenv("ALLOW_CHROMIUM_NO_SANDBOX", raising=False)
    monkeypatch.setattr(player.os, "geteuid", lambda: 1000, raising=False)

    use_no_sandbox, blocked_reason = player.resolve_chromium_sandbox_policy()

    assert use_no_sandbox is False
    assert blocked_reason is None


def test_chromium_sandbox_policy_blocks_root_without_explicit_override(monkeypatch):
    monkeypatch.delenv("ALLOW_CHROMIUM_NO_SANDBOX", raising=False)
    monkeypatch.setattr(player.os, "geteuid", lambda: 0, raising=False)

    use_no_sandbox, blocked_reason = player.resolve_chromium_sandbox_policy()

    assert use_no_sandbox is False
    assert blocked_reason == "root_requires_explicit_override"


def test_chromium_sandbox_policy_allows_explicit_override(monkeypatch):
    monkeypatch.setenv("ALLOW_CHROMIUM_NO_SANDBOX", "true")
    monkeypatch.setattr(player.os, "geteuid", lambda: 0, raising=False)

    use_no_sandbox, blocked_reason = player.resolve_chromium_sandbox_policy()

    assert use_no_sandbox is True
    assert blocked_reason is None

