"""Shared Kenyan mobile number validation and normalization."""

import re


def normalize_kenyan_phone(value):
    """Validate and normalize a Kenyan mobile number.

    Accepts 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX, +2541XXXXXXXX,
    2547XXXXXXXX and 2541XXXXXXXX. Returns the canonical 2547XXXXXXXX /
    2541XXXXXXXX form without a leading +.
    """
    if value is None:
        raise ValueError("Phone number is required")
    phone = re.sub(r"\D", "", str(value).strip())
    if not phone:
        raise ValueError("Phone number is required")
    if phone.startswith("0") and len(phone) == 10:
        if phone[1] not in ("7", "1"):
            raise ValueError("Invalid Kenyan mobile number")
        phone = "254" + phone[1:]
    if len(phone) == 12 and phone.startswith("254"):
        if phone[3] not in ("7", "1"):
            raise ValueError("Invalid Kenyan mobile number")
        return phone
    raise ValueError("Invalid Kenyan mobile number")
