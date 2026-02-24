from lan_sync import LanSyncService


def test_beacon_signature_verifies_with_matching_key():
    payload = {
        "v": 1,
        "session_id": "session-1",
        "master_device_id": "device-master",
        "seq": 1,
        "sent_at_ms": 1234567890,
        "phase_ms": 42.0,
        "duration_ms": 10000,
        "playback_speed": 1.0,
    }

    signature = LanSyncService.sign_beacon_payload(payload, "secret-key")
    assert isinstance(signature, str) and len(signature) == 64

    signed = dict(payload)
    signed["sig_alg"] = "hmac-sha256"
    signed["sig"] = signature

    assert LanSyncService.verify_beacon_payload_signature(signed, "secret-key") is True


def test_beacon_signature_rejects_tampered_payload_or_missing_sig():
    payload = {
        "v": 1,
        "session_id": "session-1",
        "master_device_id": "device-master",
        "seq": 5,
        "sent_at_ms": 1234567890,
        "phase_ms": 42.0,
        "duration_ms": 10000,
        "playback_speed": 1.0,
    }
    sig = LanSyncService.sign_beacon_payload(payload, "secret-key")
    signed = dict(payload)
    signed["sig_alg"] = "hmac-sha256"
    signed["sig"] = sig

    tampered = dict(signed)
    tampered["phase_ms"] = 99.0

    assert LanSyncService.verify_beacon_payload_signature(tampered, "secret-key") is False
    assert LanSyncService.verify_beacon_payload_signature(payload, "secret-key") is False


def test_beacon_signature_is_optional_when_auth_key_not_configured():
    payload = {"session_id": "session-1", "master_device_id": "device-master"}
    assert LanSyncService.sign_beacon_payload(payload, None) is None
    assert LanSyncService.verify_beacon_payload_signature(payload, None) is True

