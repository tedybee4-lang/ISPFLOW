# MAPITOPROJECT - PayHero Channel Model Setup

## Project Structure
Created `isp-billing-backend-mas` directory with the following structure:

```
isp-billing-backend-mas/
  app/
    __init__.py
    api/
      __init__.py
      v1/
        __init__.py
        payments/
          __init__.py
          payhero_router.py
    models/
      base.py
      payhero_channel.py
      __init__.py
    schemas/
      payhero.py
      __init__.py
    services/
      payhero_service.py
      __init__.py
```

## Files Created

### 1. `app/models/payhero_channel.py`
SQLAlchemy model for PayHero channels with:
- Organization isolation via `organization_id`
- Channel identification (`channel_id`, `channel_creation_id`)
- Payment method support (`till_number`, `paybill_number`)
- Status tracking (`is_active`, `is_validated`, `validation_status`)
- Unique constraints for data integrity

### 2. `app/models/base.py`
BaseMixin providing common columns: `id`, `created_at`, `updated_at`

### 3. `app/schemas/payhero.py`
Pydantic schemas for API validation:
- `PayHeroConfig` - Configuration with payment method validation
- `PayHeroChannelCreate` - Channel creation request
- `PayHeroChannelResponse` - Channel response model
- `PayHeroCallbackVerification` - Webhook callback validation
- `PayHeroPaymentCreate` - Payment creation with amount validation

### 4. `app/services/payhero_service.py`
Async service class with:
- `create_channel_if_needed()` - Auto-create or retrieve channels
- `process_payment()` - Process payments through PayHero API
- `verify_callback()` - Verify webhook callbacks with HMAC signature validation
- Helper methods for sandbox mode and URL selection

### 5. `app/api/v1/payments/payhero_router.py`
FastAPI router with endpoints:
- `POST /configure` - Configure/channels for organizations
- `POST /process-payment` - Process payments
- `POST /callback` - Verify webhook callbacks
- `GET /status/{channel_id}` - Check channel status

### 6. Original Model Preserved
- `isp-billing-backend-mas.old` - Contains the original PayHeroChannel model

## Usage
The setup provides a complete PayHero payment integration with:
- Tenant isolation per organization
- Sandbox/production mode switching
- Channel auto-creation
- Payment processing
- Webhook callback verification