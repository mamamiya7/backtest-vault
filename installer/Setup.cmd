@echo off
setlocal DisableDelayedExpansion
rem Runs in ordinary cmd.exe. No PowerShell, runtime installation or admin access.
set "BV_MODE=setup"
if /i "%BV_INSTALL_MODE%"=="update" set "BV_MODE=update"
set "BV_INSTALL_MODE="
set "BV_PACKAGE=%~dp0"
set "BV_TARGET="
set "BV_NO_OPEN="
set "BV_NON_INTERACTIVE="
set "BV_STAGE="
set "BV_OWNS_STAGE="
set "BV_LOCKED="
set "BV_KEEP_STAGE="
set "BV_RESULT=1"
set "BV_FILES=background.js capture.js core.js dashboard.js date-range.js date-range.css workspace-motion.js workspace-motion.css demo.js experiment-coordinator.js experiments-ui.js experiments.css experiments.js index.html intelligence-ui.js intelligence.js presentation.js runner.js setup.js source-layouts.js storage.js vault.css manifest.json"

:arguments
if "%~1"=="" goto arguments_done
if /i "%~1"=="--no-open" goto option_no_open
if /i "%~1"=="--non-interactive" goto option_non_interactive
if /i "%~1"=="--target" goto option_target
if /i "%~1"=="--help" goto help
if defined BV_TARGET goto bad_arguments
set "BV_TARGET=%~1"
shift
goto arguments

:option_no_open
set "BV_NO_OPEN=1"
shift
goto arguments

:option_non_interactive
set "BV_NON_INTERACTIVE=1"
set "BV_NO_OPEN=1"
shift
goto arguments

:option_target
if defined BV_TARGET goto bad_arguments
shift
if "%~1"=="" goto bad_arguments
set "BV_TARGET=%~1"
shift
goto arguments

:arguments_done
echo.
echo Backtest Vault - Windows %BV_MODE%
echo.
if defined BV_TARGET goto resolve_target
if /i "%BV_MODE%"=="update" goto ask_existing_target
if not defined LOCALAPPDATA goto missing_localappdata
set "BV_TARGET=%LOCALAPPDATA%\BacktestVault\extension"
goto resolve_target

:ask_existing_target
if defined BV_NON_INTERACTIVE goto missing_target
echo In Chrome or Edge, open the existing extension's Details page.
echo Copy the Loaded from folder. Keep that same folder to keep your Vault.
echo.
set /p "BV_TARGET=Existing extension folder (the folder containing manifest.json): "
if not defined BV_TARGET goto missing_target

:resolve_target
rem Normalize only; do not execute user input or pass it through CALL.
rem Windows Copy as path includes quotes; quotes cannot be part of a filename.
set "BV_TARGET=%BV_TARGET:"=%"
for %%I in ("%BV_TARGET%") do set "BV_TARGET=%%~fI"
for %%I in ("%BV_TARGET%") do set "BV_DRIVE_ROOT=%%~dI\"
if /i "%BV_TARGET%"=="%BV_DRIVE_ROOT%" goto unsafe_target
if /i "%BV_TARGET%"=="%BV_PACKAGE%extension" goto unsafe_target
if not exist "%BV_PACKAGE%extension-files.txt" goto incomplete_package
if not exist "%BV_PACKAGE%extension-sha256.txt" goto incomplete_package
if not exist "%BV_PACKAGE%extension\manifest.json" goto incomplete_package
if not exist "%SystemRoot%\System32\certutil.exe" goto missing_utilities
if not defined TEMP goto missing_temp
set "BV_REPARSE="
set "BV_PROBE=%BV_TARGET%"
call :check_ancestors
if defined BV_REPARSE goto reparse_target
set "BV_PROBE=%BV_PACKAGE%extension"
call :check_ancestors
if defined BV_REPARSE goto reparse_target
for %%F in (extension-files.txt extension-sha256.txt) do call :check_package_file %%F
if defined BV_REPARSE goto reparse_target
set "BV_STAGE=%TEMP%\BacktestVault-install-%RANDOM%-%RANDOM%"
if exist "%BV_STAGE%" goto staging_failed
mkdir "%BV_STAGE%\new" >nul 2>&1
if errorlevel 1 goto staging_failed
set "BV_OWNS_STAGE=1"
mkdir "%BV_STAGE%\old" >nul 2>&1
if errorlevel 1 goto staging_failed
mkdir "%BV_STAGE%\absent" >nul 2>&1
if errorlevel 1 goto staging_failed
set "BV_FAILED="
rem Treat the external list strictly as data; never CALL with its contents.
(for %%F in (%BV_FILES%) do echo %%F) > "%BV_STAGE%\expected-list.txt"
"%SystemRoot%\System32\sort.exe" < "%BV_STAGE%\expected-list.txt" > "%BV_STAGE%\expected-sorted.txt"
if errorlevel 1 goto incomplete_package
"%SystemRoot%\System32\sort.exe" < "%BV_PACKAGE%extension-files.txt" > "%BV_STAGE%\received-sorted.txt"
if errorlevel 1 goto incomplete_package
"%SystemRoot%\System32\fc.exe" /l "%BV_STAGE%\expected-sorted.txt" "%BV_STAGE%\received-sorted.txt" >nul 2>&1
if errorlevel 1 goto incomplete_package
rem FINDSTR end-of-line matching expects CRLF even when the ZIP uses LF.
"%SystemRoot%\System32\more.com" < "%BV_PACKAGE%extension-sha256.txt" > "%BV_STAGE%\hashes-crlf.txt"
if errorlevel 1 goto incomplete_package
echo Checking the downloaded extension...
for %%F in (%BV_FILES%) do call :stage_file %%F
if defined BV_FAILED goto damaged_package
if /i "%BV_MODE%"=="update" if not exist "%BV_TARGET%\manifest.json" goto not_vault
if exist "%BV_TARGET%\manifest.json" goto validate_existing
if exist "%BV_TARGET%" goto require_empty_target
goto create_target

:require_empty_target
dir /b /a "%BV_TARGET%" > "%BV_STAGE%\target-contents.txt" 2>nul
for %%I in ("%BV_STAGE%\target-contents.txt") do if not "%%~zI"=="0" goto not_vault
goto create_target

:validate_existing
rem Recognize the supported manifest template, ignoring only its version.
rem Customized/older layouts use the documented manual in-place update.
"%SystemRoot%\System32\more.com" < "%BV_TARGET%\manifest.json" > "%BV_STAGE%\manifest-crlf.txt"
if errorlevel 1 goto not_vault
"%SystemRoot%\System32\findstr.exe" /r /x /c:" *\"version\": \"[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\"," < "%BV_STAGE%\manifest-crlf.txt" > "%BV_STAGE%\valid-version.txt"
if errorlevel 1 goto not_vault
set "BV_VERSION_COUNT=0"
for /f "usebackq delims=" %%V in ("%BV_STAGE%\valid-version.txt") do set /a BV_VERSION_COUNT+=1 >nul
if not "%BV_VERSION_COUNT%"=="1" goto not_vault
"%SystemRoot%\System32\findstr.exe" /l /c:"\"version\":" < "%BV_STAGE%\manifest-crlf.txt" > "%BV_STAGE%\all-versions.txt"
"%SystemRoot%\System32\fc.exe" /l "%BV_STAGE%\valid-version.txt" "%BV_STAGE%\all-versions.txt" >nul 2>&1
if errorlevel 1 goto not_vault
"%SystemRoot%\System32\findstr.exe" /v /l /c:"\"version\":" < "%BV_STAGE%\new\manifest.json" > "%BV_STAGE%\new-manifest.txt"
if errorlevel 1 goto not_vault
"%SystemRoot%\System32\findstr.exe" /v /l /c:"\"version\":" < "%BV_TARGET%\manifest.json" > "%BV_STAGE%\old-manifest.txt"
if errorlevel 1 goto not_vault
"%SystemRoot%\System32\fc.exe" /l /w "%BV_STAGE%\new-manifest.txt" "%BV_STAGE%\old-manifest.txt" >nul 2>&1
if errorlevel 1 goto not_vault
if not exist "%BV_TARGET%\core.js" goto not_vault
if not exist "%BV_TARGET%\index.html" goto not_vault
if not exist "%BV_TARGET%\capture.js" goto not_vault
set "BV_MODE=update"
goto create_target

:create_target
if exist "%BV_TARGET%\" goto take_lock
mkdir "%BV_TARGET%" >nul 2>&1
if errorlevel 1 goto target_unwritable

:take_lock
mkdir "%BV_TARGET%\.backtest-vault-install.lock" >nul 2>&1
if errorlevel 1 goto locked_target
set "BV_LOCKED=1"
echo Installing to:
echo   "%BV_TARGET%"
echo.
rem Finish every backup before overwriting any installed file.
for %%F in (%BV_FILES%) do call :backup_file %%F
if defined BV_FAILED goto backup_failed
rem manifest.json is deliberately last. The browser reload remains explicit.
for %%F in (%BV_FILES%) do call :install_file %%F
if defined BV_FAILED goto rollback
set "BV_RESULT=0"
echo Extension files are ready.
echo.
if /i "%BV_MODE%"=="update" goto update_instructions
echo In Chrome or Edge, open Extensions, turn on Developer mode,
echo choose Load unpacked, and select this folder:
echo   "%BV_TARGET%"
echo.
echo Already have Vault installed? Use Update.cmd with its existing folder
echo instead of loading a second copy. Do not remove your existing extension.
goto success_instructions

:update_instructions
echo In Chrome or Edge, open Extensions and click Reload on Backtest Vault.
echo Then refresh your RZone and Vault tabs. Your browser archive is unchanged.

:success_instructions
echo.
echo Keep this installed folder. Extract future releases and run Update.cmd.
if defined BV_NO_OPEN goto finish
if exist "%BV_PACKAGE%START-HERE.html" start "" "%BV_PACKAGE%START-HERE.html"
goto finish

:rollback
echo.
echo A file could not be replaced. Restoring the previous extension files...
set "BV_ROLLBACK_FAILED="
for %%F in (%BV_FILES%) do call :restore_file %%F
if defined BV_ROLLBACK_FAILED goto rollback_failed
echo Previous files restored. Close applications using this folder and retry.
goto finish

:rollback_failed
echo ERROR: Some files could not be restored. Do not reload the extension yet.
echo Recovery copies are retained at:
echo   "%BV_STAGE%\old"
echo Target:
echo   "%BV_TARGET%"
set "BV_KEEP_STAGE=1"
goto finish

:stage_file
if defined BV_FAILED exit /b 1
if not exist "%BV_PACKAGE%extension\%~1" goto file_failed
for %%A in ("%BV_PACKAGE%extension\%~1") do set "BV_ATTRIBUTES=%%~aA"
if not "%BV_ATTRIBUTES:l=%"=="%BV_ATTRIBUTES%" goto file_failed
if exist "%BV_PACKAGE%extension\%~1\" goto file_failed
set "BV_EXPECTED="
set "BV_HASH_COUNT=0"
rem Filter before expanding any external text; only hexadecimal hashes survive.
"%SystemRoot%\System32\findstr.exe" /r /x /c:"[0-9a-fA-F][0-9a-fA-F]*  extension/%~1" < "%BV_STAGE%\hashes-crlf.txt" > "%BV_STAGE%\candidate-hash.txt"
"%SystemRoot%\System32\findstr.exe" /l /e /c:"  extension/%~1" < "%BV_STAGE%\candidate-hash.txt" > "%BV_STAGE%\expected-hash.txt"
for /f "usebackq tokens=1" %%H in ("%BV_STAGE%\expected-hash.txt") do (
  set "BV_EXPECTED=%%H"
  set /a BV_HASH_COUNT+=1 >nul
)
if not "%BV_HASH_COUNT%"=="1" goto file_failed
if "%BV_EXPECTED:~63,1%"=="" goto file_failed
if not "%BV_EXPECTED:~64%"=="" goto file_failed
copy /b /y "%BV_PACKAGE%extension\%~1" "%BV_STAGE%\new\%~1" >nul 2>&1
if errorlevel 1 goto file_failed
"%SystemRoot%\System32\certutil.exe" -hashfile "%BV_STAGE%\new\%~1" SHA256 > "%BV_STAGE%\hash.txt" 2>nul
if errorlevel 1 goto file_failed
"%SystemRoot%\System32\findstr.exe" /i /l /x /c:"%BV_EXPECTED%" < "%BV_STAGE%\hash.txt" >nul
if errorlevel 1 goto file_failed
exit /b 0

:backup_file
if defined BV_FAILED exit /b 1
if not exist "%BV_TARGET%\%~1" goto record_absent
for %%A in ("%BV_TARGET%\%~1") do set "BV_ATTRIBUTES=%%~aA"
if not "%BV_ATTRIBUTES:l=%"=="%BV_ATTRIBUTES%" goto file_failed
if exist "%BV_TARGET%\%~1\" goto file_failed
copy /b /y "%BV_TARGET%\%~1" "%BV_STAGE%\old\%~1" >nul 2>&1
if errorlevel 1 goto file_failed
"%SystemRoot%\System32\fc.exe" /b "%BV_TARGET%\%~1" "%BV_STAGE%\old\%~1" >nul 2>&1
if errorlevel 1 goto file_failed
exit /b 0

:record_absent
type nul > "%BV_STAGE%\absent\%~1"
if errorlevel 1 goto file_failed
exit /b 0

:install_file
if defined BV_FAILED exit /b 1
copy /b /y "%BV_STAGE%\new\%~1" "%BV_TARGET%\%~1" >nul 2>&1
if errorlevel 1 goto file_failed
"%SystemRoot%\System32\fc.exe" /b "%BV_STAGE%\new\%~1" "%BV_TARGET%\%~1" >nul 2>&1
if errorlevel 1 goto file_failed
exit /b 0

:file_failed
echo ERROR: A file could not be verified or copied: %~1
set "BV_FAILED=1"
exit /b 1

:restore_file
if exist "%BV_STAGE%\old\%~1" goto restore_old
if not exist "%BV_STAGE%\absent\%~1" goto restore_failed
if not exist "%BV_TARGET%\%~1" exit /b 0
del /q "%BV_TARGET%\%~1" >nul 2>&1
if exist "%BV_TARGET%\%~1" goto restore_failed
exit /b 0

:restore_old
"%SystemRoot%\System32\fc.exe" /b "%BV_STAGE%\old\%~1" "%BV_TARGET%\%~1" >nul 2>&1
if not errorlevel 1 exit /b 0
copy /b /y "%BV_STAGE%\old\%~1" "%BV_TARGET%\%~1" >nul 2>&1
if errorlevel 1 goto restore_failed
"%SystemRoot%\System32\fc.exe" /b "%BV_STAGE%\old\%~1" "%BV_TARGET%\%~1" >nul 2>&1
if errorlevel 1 goto restore_failed
exit /b 0

:restore_failed
set "BV_ROLLBACK_FAILED=1"
exit /b 1

:cleanup_file
if exist "%BV_STAGE%\new\%~1" del /q "%BV_STAGE%\new\%~1" >nul 2>&1
if exist "%BV_STAGE%\old\%~1" del /q "%BV_STAGE%\old\%~1" >nul 2>&1
if exist "%BV_STAGE%\absent\%~1" del /q "%BV_STAGE%\absent\%~1" >nul 2>&1
exit /b 0

:check_package_file
for %%A in ("%BV_PACKAGE%%~1") do set "BV_ATTRIBUTES=%%~aA"
if not "%BV_ATTRIBUTES:l=%"=="%BV_ATTRIBUTES%" set "BV_REPARSE=1"
exit /b 0

:check_ancestors
for %%A in ("%BV_PROBE%") do set "BV_ATTRIBUTES=%%~aA"
if not defined BV_ATTRIBUTES goto next_ancestor
if not "%BV_ATTRIBUTES:l=%"=="%BV_ATTRIBUTES%" goto found_reparse
:next_ancestor
for %%A in ("%BV_PROBE%\..") do set "BV_PARENT=%%~fA"
if /i "%BV_PARENT%"=="%BV_PROBE%" exit /b 0
set "BV_PROBE=%BV_PARENT%"
goto check_ancestors

:found_reparse
set "BV_REPARSE=1"
exit /b 1

:bad_arguments
echo ERROR: Use Setup.cmd or Update.cmd [--target "folder"] [--no-open] [--non-interactive].
goto finish

:help
echo Setup.cmd [--target "folder" ^| "folder"] [--no-open] [--non-interactive]
echo Update.cmd uses the same options and requires an existing Vault folder.
echo Setup defaults to LOCALAPPDATA\BacktestVault\extension.
echo Non-interactive mode never prompts, pauses or opens a browser.
set "BV_RESULT=0"
set "BV_NON_INTERACTIVE=1"
goto finish

:missing_target
echo ERROR: Update needs the existing extension folder. Use --target "folder".
goto finish

:missing_localappdata
echo ERROR: LOCALAPPDATA is unavailable. Specify a folder with --target.
goto finish

:missing_temp
echo ERROR: TEMP is unavailable. No extension files were changed.
goto finish

:unsafe_target
echo ERROR: Choose a dedicated extension folder, not a drive root or this download.
goto finish

:reparse_target
echo ERROR: Symbolic links and directory junctions are not supported for installation.
echo Extract into a regular folder and choose a regular installation folder.
goto finish

:incomplete_package
echo ERROR: This download is incomplete or its file list was changed.
echo Extract the complete official release ZIP into one folder and try again.
goto finish

:missing_utilities
echo ERROR: Windows certificate utility is unavailable. Package verification cannot run.
goto finish

:damaged_package
echo ERROR: Package verification failed. No extension files were changed.
echo Download and extract a fresh official release. Security policy was not changed.
goto finish

:staging_failed
echo ERROR: A temporary installation folder could not be created. Please retry.
goto finish

:not_vault
echo ERROR: This folder is not a supported Backtest Vault extension folder.
echo Choose its existing folder containing manifest.json, or an empty new folder.
echo Older or customized manifests can use the manual update in START-HERE.html.
echo No existing files were changed.
goto finish

:target_unwritable
echo ERROR: This folder could not be created. Choose a folder you can write to.
goto finish

:locked_target
echo ERROR: The folder is unavailable or another installation is in progress.
echo If a previous installation was interrupted, keep the current files and
echo contact support before removing .backtest-vault-install.lock.
goto finish

:backup_failed
echo ERROR: Existing files could not be backed up. They were not changed.
goto finish

:finish
if defined BV_LOCKED rmdir "%BV_TARGET%\.backtest-vault-install.lock" >nul 2>&1
if not defined BV_OWNS_STAGE goto finish_pause
if defined BV_KEEP_STAGE goto finish_pause
for %%F in (%BV_FILES%) do call :cleanup_file %%F
if exist "%BV_STAGE%\hash.txt" del /q "%BV_STAGE%\hash.txt" >nul 2>&1
if exist "%BV_STAGE%\target-contents.txt" del /q "%BV_STAGE%\target-contents.txt" >nul 2>&1
for %%F in (expected-list.txt expected-sorted.txt received-sorted.txt new-manifest.txt old-manifest.txt valid-version.txt all-versions.txt candidate-hash.txt expected-hash.txt hashes-crlf.txt manifest-crlf.txt) do if exist "%BV_STAGE%\%%F" del /q "%BV_STAGE%\%%F" >nul 2>&1
if exist "%BV_STAGE%\new" rmdir "%BV_STAGE%\new" >nul 2>&1
if exist "%BV_STAGE%\old" rmdir "%BV_STAGE%\old" >nul 2>&1
if exist "%BV_STAGE%\absent" rmdir "%BV_STAGE%\absent" >nul 2>&1
if exist "%BV_STAGE%" rmdir "%BV_STAGE%" >nul 2>&1

:finish_pause
if defined BV_NON_INTERACTIVE exit /b %BV_RESULT%
echo.
pause
exit /b %BV_RESULT%
