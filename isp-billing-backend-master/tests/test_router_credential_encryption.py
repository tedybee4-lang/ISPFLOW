from app.models.router import Router
from app.schemas.router import Router as RouterResponse


def test_router_password_is_encrypted_in_storage_and_usable_by_router_services():
    plaintext = "local-router-test-password"

    router = Router(password=plaintext)

    assert router._password.startswith("enc:v1:")
    assert plaintext not in router._password
    assert router.password == plaintext


def test_router_password_reads_legacy_plaintext_for_existing_records():
    router = Router()
    router._password = "legacy-router-password"

    assert router.password == "legacy-router-password"


def test_router_password_replacement_is_encrypted():
    router = Router(password="first-password")
    router.password = "replacement-password"

    assert router._password.startswith("enc:v1:")
    assert "replacement-password" not in router._password
    assert router.password == "replacement-password"


def test_router_api_response_schema_excludes_router_credentials():
    assert "password" not in RouterResponse.model_fields
    assert "username" not in RouterResponse.model_fields
