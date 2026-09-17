@echo off
setlocal DisableDelayedExpansion
set "BV_INSTALL_MODE=update"
rem Transfer directly: CALL would expand percent signs in paths a second time.
"%~dp0Setup.cmd" %*
