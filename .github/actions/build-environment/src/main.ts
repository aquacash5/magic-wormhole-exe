import { debug, getInput, setFailed, setOutput } from "@actions/core";
import * as semverSort from "semver-sort";
import { z } from "zod";

const PyPIJson = z.object({
  releases: z.record(z.string(), z.array(z.any())),
});

const GithubReleases = z.array(
  z.object({
    tag_name: z.string(),
  })
);

function debugValue(name: string, value: any) {
  debug(`${name}: ${JSON.stringify(value)}`);
}

function onError(err: unknown) {
  if (typeof err === "string" || err instanceof Error) {
    setFailed(err);
  } else {
    console.error("Unknown error kind:", err);
    setFailed("Unknown failure");
  }
}

async function getPyPIVersions(): Promise<string[]> {
  const response = await fetch("https://pypi.org/pypi/magic-wormhole/json");
  const jsonResults = await response.json();
  debugValue("PyPI response", jsonResults);
  const results = PyPIJson.parse(jsonResults);
  return semverSort.desc(Object.keys(results.releases));
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

async function main() {
  const pyPIPromise = getPyPIVersions();
  const githubReleasesPromise = getGithubReleases();

  //#region Version check

  const userVersion = getInput("version", { trimWhitespace: true });
  console.log("user version:", userVersion);

  const pyPIVersions = await pyPIPromise;
  debugValue("pyPIVersions", pyPIVersions);

  const finalVersion = userVersion || pyPIVersions[0];
  console.log("finalVersion version:", finalVersion);

  if (!pyPIVersions.includes(finalVersion))
    throw new Error(`version ${finalVersion} is not a valid version in PyPI`);

  setOutput("version", finalVersion);

  //#endregion

  //#region Github release check

  const githubReleases = await githubReleasesPromise;
  debugValue("githubReleases", githubReleases);

  const releaseExists = githubReleases.includes(finalVersion);

  console.log("exists:", releaseExists);

  setOutput("exists", releaseExists);

  //#endregion
}

main().catch(onError);
