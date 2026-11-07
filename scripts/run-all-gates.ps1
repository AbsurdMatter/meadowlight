#Requires -Version 5.1
<#
.SYNOPSIS
  Full-suite gate runner for meadowlight (session 10, issue #74).

  Runs every behavioral gate script against a running dev server and prints
  per-family PASS/FAIL counts plus a total. Exit code is non-zero if any
  family failed (the exit-code status is the primary signal; the counts are
  the detail).

  Usage:
    1. Start the dev server:  npm run dev        (default http://localhost:5173)
    2. Run:                   powershell -File scripts/run-all-gates.ps1
       Optional:             -Url http://localhost:5199 -LibPath C:\path\to\libs

  The --checks lists below are asserted against the gates' own dispatchChecks
  registries by scripts/gate-list-lint.mjs (wired into test:smoke) — a rename
  that doesn't update this file turns CI red.
#>
[CmdletBinding()]
param(
  [string]$Url = 'http://localhost:5173',
  [string]$LibPath = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$node = 'node'

# gate invocations: script, then args. session10 runs with NO --checks flag
# (it defaults to its full family list per its design).
$jobs = @(
  @{ Script = 'scripts\browser-gate.mjs'; Args = @('--url', $Url, '--checks', 'boot,onboarding,audio,postcard,solitary,perf') },
  @{ Script = 'scripts\bee-gate.mjs';     Args = @('--url', $Url) },
  @{ Script = 'scripts\session5-gate.mjs'; Args = @('--url', $Url, '--checks', 'roster,terrain,bushes,sky,wild,daynight,weather,triggers') },
  @{ Script = 'scripts\session6-gate.mjs'; Args = @('--url', $Url) },
  @{ Script = 'scripts\session7-gate.mjs'; Args = @('--url', $Url, '--checks', 'seeding') },
  @{ Script = 'scripts\session7-gate.mjs'; Args = @('--url', $Url, '--checks', 'timecontrols') },
  @{ Script = 'scripts\session7-gate.mjs'; Args = @('--url', $Url, '--checks', 'visitors,colony,habitat,nightsky') },
  @{ Script = 'scripts\session8-gate.mjs'; Args = @('--url', $Url, '--checks', 'precip') },
  @{ Script = 'scripts\session8-gate.mjs'; Args = @('--url', $Url, '--checks', 'magnifier') },
  @{ Script = 'scripts\session9-gate.mjs'; Args = @('--url', $Url, '--checks', 'keys,chrome') },
  @{ Script = 'scripts\session9-gate.mjs'; Args = @('--url', $Url, '--checks', 'onboarding,journal,audio,touch,popups') },
  @{ Script = 'scripts\session10-gate.mjs'; Args = @('--url', $Url) }
)

if ($LibPath -ne '') { $env:LD_LIBRARY_PATH = $LibPath }

$totalPass = 0
$totalFail = 0
$anyFailed = $false

foreach ($job in $jobs) {
  $label = $job.Script + ' ' + ($job.Args -join ' ')
  Write-Host "=== $label"
  # PS 5.1-safe invocation: ProcessStartInfo.ArgumentList is .NET Core 2.1+ /
  # PowerShell 7+ only (null on 5.1). Build a single Arguments string instead.
  $argString = ($job.Args | ForEach-Object {
      if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\\"') + '"' } else { $_ }
    }) -join ' '
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = ('"' + $job.Script + '" ' + $argString)
  $psi.WorkingDirectory = $root
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  [void]$p.WaitForExit()
  $exit = $p.ExitCode
  $pass = 0; $fail = 0
  foreach ($line in ($stdout -split "`r?`n")) {
    # NOTE: the [GATE] brackets MUST be escaped in the regex — unescaped
    # [GATE] is a character class matching one of G/A/T/E and counts 0/0.
    if ($line -match '\[GATE\] PASS') { $pass++ }
    elseif ($line -match '\[GATE\] FAIL') { $fail++; Write-Host $line }
  }
  $totalPass += $pass
  $totalFail += $fail
  if ($exit -ne 0 -or $fail -gt 0) { $anyFailed = $true }
  $status = if ($exit -eq 0 -and $fail -eq 0) { 'OK' } else { 'FAILED (exit=' + $exit + ')' }
  Write-Host ("  -> {0}  PASS {1} / FAIL {2}" -f $status, $pass, $fail)
  if ($stderr -and $stderr.Trim() -ne '') { Write-Host $stderr }
}

Write-Host ("TOTAL: PASS {0} / FAIL {1}" -f $totalPass, $totalFail)
if ($anyFailed) { exit 1 } else { exit 0 }
