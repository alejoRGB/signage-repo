import logging

import logger_service
from logger_service import LoggerService, log_sync_event


class DummySyncManager:
    def __init__(self, token="token-1", server_url="http://example.test"):
        self.device_token = token
        self.server_url = server_url


def make_record(message: str, *, level=logging.INFO):
    return logging.LogRecord(
        name="test",
        level=level,
        pathname=__file__,
        lineno=1,
        msg=message,
        args=(),
        exc_info=None,
    )


def test_logger_does_not_buffer_remote_logs_before_pairing():
    svc = LoggerService(DummySyncManager(token=None))
    try:
        svc.emit(make_record("PAIRING CODE: 123456"))
        assert svc.log_queue.qsize() == 0
    finally:
        svc.stop()


def test_logger_requeues_batch_on_non_200(monkeypatch):
    svc = LoggerService(DummySyncManager())

    class Response:
        status_code = 500

    def fake_post(*_args, **_kwargs):
        return Response()

    monkeypatch.setattr(logger_service.requests, "post", fake_post)

    try:
        svc.emit(make_record("hello"))
        assert svc.log_queue.qsize() == 1
        svc.flush_logs()
        assert svc.log_queue.qsize() == 1
    finally:
        svc.stop()


def test_logger_bounds_queue_and_redacts_pairing_code():
    svc = LoggerService(DummySyncManager())
    svc.max_queue_size = 2
    svc.log_queue = logger_service.queue.Queue(maxsize=2)
    try:
        svc.emit(make_record("first"))
        svc.emit(make_record("PAIRING CODE: 999999"))
        svc.emit(make_record("third"))
        assert svc.log_queue.qsize() == 2
        queued = []
        while not svc.log_queue.empty():
            queued.append(svc.log_queue.get_nowait())
        messages = [entry["message"] for entry in queued]
        assert all("999999" not in msg for msg in messages)
        assert "first" not in messages[0] or "first" not in messages[1]
    finally:
        svc.stop()


def test_logger_sends_contract_versions_in_batch(monkeypatch):
    svc = LoggerService(DummySyncManager())
    captured = {}

    class Response:
        status_code = 200

    def fake_post(_url, json=None, timeout=None):
        captured["payload"] = json
        captured["timeout"] = timeout
        return Response()

    monkeypatch.setattr(logger_service.requests, "post", fake_post)

    try:
        svc.emit(make_record("hello"))
        svc.flush_logs()
        payload = captured["payload"]
        assert payload["schema_version"] == logger_service.DEVICE_LOG_SCHEMA_VERSION
        assert payload["sync_event_contract_version"] == logger_service.SYNC_LOG_EVENT_CONTRACT_VERSION
        assert isinstance(payload["logs"], list) and payload["logs"]
    finally:
        svc.stop()


def test_unknown_sync_event_is_sent_as_raw_event(monkeypatch):
    svc = LoggerService(DummySyncManager())
    captured = {}

    class Response:
        status_code = 200

    def fake_post(_url, json=None, timeout=None):
        captured["payload"] = json
        return Response()

    monkeypatch.setattr(logger_service.requests, "post", fake_post)

    root_logger = logging.getLogger()
    root_logger.addHandler(svc)
    try:
        log_sync_event("future_event_name", session_id="session-1", data={"x": 1}, level=logging.WARNING)
        svc.flush_logs()
        log_item = next(
            item for item in captured["payload"]["logs"]
            if isinstance(item.get("data"), dict) and item["data"].get("raw_sync_event") == "FUTURE_EVENT_NAME"
        )
        assert "event" not in log_item
        assert log_item["data"]["raw_sync_event"] == "FUTURE_EVENT_NAME"
        assert log_item["data"]["unknown_sync_event"] is True
        assert log_item["session_id"] == "session-1"
    finally:
        root_logger.removeHandler(svc)
        svc.stop()
