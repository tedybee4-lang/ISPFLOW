"""Loopback-only tests for the router port diagnostic helper."""

import socket
from contextlib import closing
from typing import Tuple


def _test_port(ip: str, port: int, timeout: float = 1) -> Tuple[bool, str]:
    if ip != "127.0.0.1":
        raise ValueError("Connectivity tests are restricted to loopback.")
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
    if result == 0:
        return True, f"Port {port} is OPEN"
    return False, f"Port {port} is CLOSED (error code: {result})"


def test_port_detects_open_loopback_socket():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        port = listener.getsockname()[1]

        reachable, message = _test_port("127.0.0.1", port, timeout=1)

    assert reachable is True
    assert f"Port {port} is OPEN" in message


def test_port_reports_closed_loopback_socket():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]

    reachable, message = _test_port("127.0.0.1", port, timeout=1)

    assert reachable is False
    assert f"Port {port} is CLOSED" in message
