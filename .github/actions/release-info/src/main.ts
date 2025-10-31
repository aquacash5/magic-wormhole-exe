import { debug, getInput, setFailed, setOutput } from "@actions/core";
import * as semverSort from "semver-sort";
import { z } from "zod";

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
  const userVersion = getInput("version", { trimWhitespace: true });
  console.log("user version:", userVersion);

  const githubReleases = await getGithubReleases();
  const latestVersion = semverSort.desc(githubReleases)[0];
  debugValue("latest version:", latestVersion);

  const finalVersion = userVersion || latestVersion;
  console.log("final version:", finalVersion);

  if (!githubReleases.includes(finalVersion))
    throw new Error(
      `version ${finalVersion} is not a valid version for release`
    );

  setOutput("version", finalVersion);
}

main().catch(onError);
