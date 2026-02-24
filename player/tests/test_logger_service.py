import logging

import logger_service
from logger_service import LoggerService


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
