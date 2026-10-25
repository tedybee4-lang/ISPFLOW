"""Test configuration and fixtures."""

import os
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

from app.core.database import Base, get_db
from app.core.config import settings
from app.main import app
from app.models.organization import Organization, OrganizationType
from app.models.user import User, UserRole, UserStatus
from app.models.billing import Payment, PaymentStatus, PaymentMethod
from app.core.security import get_password_hash


# Never default tests to a database that could belong to a developer or service.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
test_engine = None

if TEST_DATABASE_URL:
    test_database = make_url(TEST_DATABASE_URL)
    if (
        test_database.get_backend_name() != "postgresql"
        or test_database.host not in {"localhost", "127.0.0.1", "::1"}
        or test_database.port != 55432
        or not (test_database.database or "").startswith("ispbilling_test")
    ):
        raise RuntimeError(
            "TEST_DATABASE_URL must target a dedicated ispbilling_test "
            "database on loopback port 55432."
        )

    test_engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )


@pytest.fixture(autouse=True)
def disable_external_rate_limits_in_tests(monkeypatch):
    """Keep unrelated request tests independent of Redis's persistent counters."""
    monkeypatch.setattr(settings, "rate_limit_enabled", False)


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def database_schema():
    """Create schema once in the disposable test database."""
    if test_engine is None:
        pytest.skip(
            "Database-backed tests require TEST_DATABASE_URL for a disposable "
            "ispbilling_test database on port 55432."
        )

    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def db_session(database_schema):
    """Run a test inside a rollback-only transaction."""
    if test_engine is None:
        pytest.skip("TEST_DATABASE_URL is required for database-backed tests.")

    async with test_engine.connect() as connection:
        transaction = await connection.begin()
        async with AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        ) as session:
            try:
                yield session
            finally:
                await session.close()
                await transaction.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """Create a test client with database session override."""
    previous_override = app.dependency_overrides.get(get_db)

    def override_get_db():
        return db_session
    
    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override


@pytest_asyncio.fixture
async def test_organization(db_session: AsyncSession) -> Organization:
    organization = Organization(
        name="Test ISP",
        slug="test-isp",
        email="isp@example.com",
        organization_type=OrganizationType.HYBRID,
    )
    db_session.add(organization)
    await db_session.flush()
    return organization


@pytest_asyncio.fixture
async def test_user(
    db_session: AsyncSession, test_organization: Organization
) -> User:
    """Create a test user."""
    user = User(
        username="testuser",
        email="test@example.com",
        organization_id=test_organization.id,
        first_name="Test",
        last_name="User",
        hashed_password=get_password_hash("testpassword"),
        role=UserRole.CUSTOMER,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_active=True,
    )
    
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    return user


@pytest_asyncio.fixture
async def test_admin_user(
    db_session: AsyncSession, test_organization: Organization
) -> User:
    """Create a test admin user."""
    admin = User(
        username="admin",
        email="admin@example.com",
        organization_id=test_organization.id,
        first_name="Admin",
        last_name="User",
        hashed_password=get_password_hash("adminpassword"),
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_active=True,
    )
    
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    
    return admin


@pytest_asyncio.fixture
async def test_technician_user(
    db_session: AsyncSession, test_organization: Organization
) -> User:
    """Create a test technician user."""
    technician = User(
        username="technician",
        email="tech@example.com",
        organization_id=test_organization.id,
        first_name="Tech",
        last_name="User",
        hashed_password=get_password_hash("techpassword"),
        role=UserRole.TECHNICIAN,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_active=True,
    )
    
    db_session.add(technician)
    await db_session.commit()
    await db_session.refresh(technician)
    
    return technician


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, test_user: User):
    """Get authentication headers for test user."""
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": test_user.username, "password": "testpassword"}
    )
    
    assert response.status_code == 200
    token_data = response.json()["data"]
    
    return {"Authorization": f"Bearer {token_data['access_token']}"}


@pytest_asyncio.fixture
async def admin_auth_headers(client: AsyncClient, test_admin_user: User):
    """Get authentication headers for admin user."""
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": test_admin_user.username, "password": "adminpassword"}
    )
    
    assert response.status_code == 200
    token_data = response.json()["data"]
    
    return {"Authorization": f"Bearer {token_data['access_token']}"}


@pytest_asyncio.fixture
async def technician_auth_headers(client: AsyncClient, test_technician_user: User):
    """Get authentication headers for technician user."""
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": test_technician_user.username, "password": "techpassword"}
    )
    
    assert response.status_code == 200
    token_data = response.json()["data"]
    
    return {"Authorization": f"Bearer {token_data['access_token']}"}


@pytest_asyncio.fixture
async def test_user_with_phone(db_session: AsyncSession) -> User:
    """Create a test user with phone number for MPESA testing."""
    user = User(
        username="testuser_phone",
        email="testphone@example.com",
        first_name="Test",
        last_name="User",
        phone="+254712345678",
        hashed_password=get_password_hash("testpassword"),
        role=UserRole.CUSTOMER,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_active=True,
    )
    
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    return user


@pytest_asyncio.fixture
async def test_payment(db_session: AsyncSession, test_user: User) -> Payment:
    """Create a test payment."""
    payment = Payment(
        user_id=test_user.id,
        amount=1000,
        currency="KES",
        payment_method=PaymentMethod.MPESA,
        status=PaymentStatus.PENDING,
        external_reference="test_checkout_id",
        description="Test Payment",
        metadata={"test": "data"}
    )
    
    db_session.add(payment)
    await db_session.commit()
    await db_session.refresh(payment)
    
    return payment


@pytest_asyncio.fixture
async def test_completed_payment(db_session: AsyncSession, test_user: User) -> Payment:
    """Create a test completed payment."""
    payment = Payment(
        user_id=test_user.id,
        amount=1000,
        currency="KES",
        payment_method=PaymentMethod.MPESA,
        status=PaymentStatus.COMPLETED,
        external_reference="test_transaction_id",
        description="Test Completed Payment",
        metadata={"test": "data"}
    )
    
    db_session.add(payment)
    await db_session.commit()
    await db_session.refresh(payment)
    
    return payment


@pytest_asyncio.fixture
def mock_mpesa_api():
    """Mock MPESA API for testing."""
    from unittest.mock import AsyncMock
    return AsyncMock()


@pytest_asyncio.fixture
def mock_mpesa_public_key():
    """Mock MPESA public key for testing."""
    from unittest.mock import MagicMock
    return MagicMock()


@pytest.fixture
def mpesa_callback_data():
    """Sample MPESA callback data for testing."""
    return {
        "signature": "test_signature",
        "Body": {
            "stkCallback": {
                "MerchantRequestID": "test_merchant_id",
                "CheckoutRequestID": "test_checkout_id",
                "ResultCode": 0,
                "ResultDesc": "The service request is processed successfully",
                "CallbackMetadata": {
                    "Item": [
                        {"Name": "Amount", "Value": "1000"},
                        {"Name": "MpesaReceiptNumber", "Value": "test_receipt"},
                        {"Name": "TransactionDate", "Value": "20241201"},
                        {"Name": "PhoneNumber", "Value": "254712345678"}
                    ]
                }
            }
        }
    }


@pytest.fixture
def mpesa_failed_callback_data():
    """Sample MPESA failed callback data for testing."""
    return {
        "signature": "test_signature",
        "Body": {
            "stkCallback": {
                "MerchantRequestID": "test_merchant_id",
                "CheckoutRequestID": "test_checkout_id",
                "ResultCode": 1,
                "ResultDesc": "The balance is insufficient for the transaction"
            }
        }
    }
