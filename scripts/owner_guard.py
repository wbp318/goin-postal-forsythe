"""Owner check. Every script imports this first.

The scripts and pages in this repository are licensed for the owners' own use
(see LICENSE and NOTICE). A clone that has not been set up by an owner stops
here with a message saying who to contact.

The check passes when either of these is true:
  * the environment variable GOIN_POSTAL_OWNER is set, or
  * a file named .owner-key exists at the repository root (it is git-ignored,
    so it never travels with a clone).
"""
import os
import sys
from pathlib import Path

CONTACT = (
    "\n"
    "  This copy of goin-postal-forsythe is not set up for use.\n"
    "  The scripts, pages, designs and research are licensed to the store's\n"
    "  owners only (see LICENSE and NOTICE). Cloning the repository does not\n"
    "  grant a right to run or use them.\n"
    "\n"
    "  To ask for permission, contact Rin Ho, William Parker or Peter Ho at\n"
    "  wbp93623@gmail.com.\n"
)

ROOT = Path(__file__).resolve().parent.parent


def is_owner() -> bool:
    return bool(os.environ.get("GOIN_POSTAL_OWNER")) or (ROOT / ".owner-key").is_file()


if not is_owner():
    sys.exit(CONTACT)
