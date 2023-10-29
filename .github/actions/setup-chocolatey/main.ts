import { debug, getInput, setFailed } from "@actions/core";
import { execSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";

const GithubReleases = z.array(
  z.object({
    tag_name: z.string(),
  })
);

function debugValue(name: string, value: any) {
  debug(`${name}: ${JSON.stringify(value)}`);
}

export function getRepoToplevel(): string {
  debug("executing 'git rev-parse --show-toplevel'");
  const repoToplevel = execSync("git rev-parse --show-toplevel")
    .toString()
    .trim();
  debugValue("toplevel of repo", repoToplevel);
  return repoToplevel;
}

async function getChecksum(version: string): Promise<string> {
  const response = await fetch(
    `https://github.com/aquacash5/magic-wormhole-exe/releases/download/${version}/wormhole.exe.checksum.txt`
  );
  const textResults = await response.text();
  debugValue("checksum response", textResults);
  const checksum = textResults
    .split("\n")
    .map((l) => l.trim().split(" "))
    .filter(([type, _checksum, _file]) => type === "SHA256")
    .map(([_type, checksum, _file]) => checksum)[0];
  if (!checksum) throw new Error("no checksum found");
  return checksum;
}

async function getGithubReleases(): Promise<string[]> {
  const response = await fetch(
    "https://api.github.com/repos/aquacash5/magic-wormhole-exe/releases"
  );
  const jsonResults = await response.json();
  debugValue("Github response", jsonResults);
  const results = GithubReleases.parse(jsonResults);
  return results.map((r) => r.tag_name);
}

function chocolateyInstallPs1(version: string, checksum: string): string {
  const versionUrl = `https://github.com/aquacash5/magic-wormhole-exe/releases/download/${version}/wormhole.exe`;
  debugValue("version url", versionUrl);

  const chocolateyInstall = `$ErrorActionPreference = 'Stop'
$packageName = '$env:ChocolateyPackageName'
$url = '${versionUrl}'
$checksum = '${checksum}'
$checksumType = 'sha256'
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$installFile = Join-Path $toolsDir "wormhole.exe"
Get-ChocolateyWebFile -PackageName "$packageName" \`
  -FileFullPath "$installFile" \`
  -Url "$url" \`
  -Checksum "$checksum" \`
  -ChecksumType "$checksumType"
`;
  debugValue("chocolateyinstall.ps1", chocolateyInstall);
  return chocolateyInstall;
}

function nuspec(
  id: string,
  title: string,
  version: string,
  dependency: boolean
): string {
  const dependencySection: string = dependency
    ? `<dependencies><dependency id="magic-wormhole.portable" version="${version}" /></dependencies>`
    : "";
  const xml = `<?xml version="1.0"?>
  <package xmlns="http://schemas.microsoft.com/packaging/2011/08/nuspec.xsd">
    <metadata>
      <id>${id}</id>
      <version>${version}</version>
      <title>${title}</title>
      <authors>aquacash5,vaporwave9,warner</authors>
      <owners>aquacash5</owners>
      <licenseUrl>https://github.com/magic-wormhole/magic-wormhole/blob/master/LICENSE</licenseUrl>
      <projectUrl>https://github.com/aquacash5/magic-wormhole-exe</projectUrl>
      <iconUrl>https://cdn.statically.io/gh/aquacash5/magic-wormhole-exe/main/logo.png</iconUrl>
      <requireLicenseAcceptance>false</requireLicenseAcceptance>
      <description>Get things from one computer to another, safely.

  This package provides a library and a command-line tool named wormhole, which makes it possible to get arbitrary-sized files and directories (or short pieces of text) from one computer to another. The two endpoints are identified by using identical "wormhole codes": in general, the sending machine generates and displays the code, which must then be typed into the receiving machine.

  The codes are short and human-pronounceable, using a phonetically-distinct wordlist. The receiving side offers tab-completion on the codewords, so usually only a few characters must be typed. Wormhole codes are single-use and do not need to be memorized.</description>
      <summary>Get things from one computer to another, safely.</summary>
      <releaseNotes>[Software Changelog](https://github.com/magic-wormhole/magic-wormhole/blob/master/NEWS.md)
  [Package Changelog](https://github.com/aquacash5/magic-wormhole-exe)</releaseNotes>
      <tags>filetransfer</tags>
      <projectSourceUrl>https://github.com/magic-wormhole/magic-wormhole</projectSourceUrl>
      <packageSourceUrl>https://github.com/aquacash5/magic-wormhole-exe</packageSourceUrl>
      <bugTrackerUrl>https://github.com/aquacash5/magic-wormhole-exe/issues</bugTrackerUrl>
      ${dependencySection}
    </metadata>
  </package>
`;
  debugValue("xml", xml);
  return xml;
}

async function main() {
  const version = getInput("version", { required: true, trimWhitespace: true });
  console.log("version:", version);

  const githubReleasesPromise = getGithubReleases();
  const checksumPromise = getChecksum(version);

  const githubReleases = await githubReleasesPromise;
  if (!githubReleases.includes(version))
    throw new Error("Version has no github release");

  const checksum = await checksumPromise;
  console.log("checksum:", checksum);

  const repoDir = path.resolve(getRepoToplevel(), "temp");

  debug("setup directories...");
  await Promise.all([
    mkdir(path.resolve(repoDir, "magic-wormhole", "tools"), {
      recursive: true,
    }),
    mkdir(path.resolve(repoDir, "magic-wormhole.portable", "tools"), {
      recursive: true,
    }),
  ]);

  debug("writing files...");
  await Promise.all([
    writeFile(
      path.resolve(repoDir, "magic-wormhole", "magic-wormhole.nuspec"),
      nuspec("magic-wormhole", "Magic Wormhole", version, true)
    ),
    writeFile(
      path.resolve(repoDir, "magic-wormhole", "tools", "chocolateyinstall.ps1"),
      "# this is a virtual package."
    ),
    writeFile(
      path.resolve(
        repoDir,
        "magic-wormhole.portable",
        "tools",
        "chocolateyinstall.ps1"
      ),
      chocolateyInstallPs1(version, checksum)
    ),
    writeFile(
      path.resolve(
        repoDir,
        "magic-wormhole.portable",
        "magic-wormhole.portable.nuspec"
      ),
      nuspec(
        "magic-wormhole.portable",
        "Magic Wormhole (Portable)",
        version,
        false
      )
    ),
  ]);
}

main().catch((e) => setFailed(e));
