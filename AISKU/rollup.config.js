import nodeResolve from "rollup-plugin-node-resolve";
import {uglify} from "rollup-plugin-uglify";
import replace from "rollup-plugin-replace";
import dynamicRemove from "@microsoft/dynamicproto-js/tools/rollup/node/removedynamic";
import { es3Poly, es3Check, importCheck } from "@microsoft/applicationinsights-rollup-es3";

const fs = require("fs");
const globby = require("globby");
const version = require("./package.json").version;
const banner = [
  "/*!",
  ` * Application Insights JavaScript SDK - Web, ${version}`,
  " * Copyright (c) Microsoft and contributors. All rights reserved.",
  " */"
].join("\n");

const replaceValues = {
  "// Copyright (c) Microsoft Corporation. All rights reserved.": "",
  "// Licensed under the MIT License.": ""
};

// Function to remove the @DynamicProtoStubs and rewrite the headers for the dist-esm files
const updateDistEsmFiles = () => {
  const dynRemove = dynamicRemove();
  const files = globby.sync("dist-esm/**/*.js");
  files.map(inputFile => {
    console.log("Loading - " + inputFile);
    var src = fs.readFileSync(inputFile, "utf8");
    var result = dynRemove.transform(src, inputFile);
    if (result !== null && result.code) {
      console.log("Prototypes removed...");
      src = result.code;
    }

    // Rewrite the file
    Object.keys(replaceValues).forEach((value) => {
      src = src.replace(value, replaceValues[value]);
    });
    src = src.trim();
    fs.writeFileSync(inputFile, banner + "\n" + src);
  });
};

const browserRollupConfigFactory = (isProduction, libVersion = '2') => {
  const browserRollupConfig = {
    input: "dist-esm/Init.js",
    output: {
      file: `browser/ai.${libVersion}.js`,
      banner: banner,
      format: "umd",
      name: "Microsoft.ApplicationInsights",
      sourcemap: true
    },
    plugins: [
      dynamicRemove(),
      replace({
        delimiters: ["", ""],
        values: replaceValues
      }),
      importCheck({ exclude: [ "applicationinsights-web" ] }),
      nodeResolve({
        browser: false,
        preferBuiltins: false
      }),
      es3Poly(),
      es3Check()
    ]
  };

  if (isProduction) {
    browserRollupConfig.output.file = `browser/ai.${libVersion}.min.js`;
    browserRollupConfig.plugins.push(
      uglify({
        ie8: true,
        output: {
          preamble: banner
        }
      })
    );
  }

  return browserRollupConfig;
};

const nodeUmdRollupConfigFactory = (isProduction) => {
  const nodeRollupConfig = {
    input: `dist-esm/applicationinsights-web.js`,
    output: {
      file: `dist/applicationinsights-web.js`,
      banner: banner,
      format: "umd",
      name: "Microsoft.ApplicationInsights",
      sourcemap: true
    },
    plugins: [
      dynamicRemove(),
      replace({
        delimiters: ["", ""],
        values: replaceValues
      }),
      importCheck({ exclude: [ "applicationinsights-web" ] }),
      nodeResolve(),
      es3Poly(),
      es3Check()
    ]
  };

  if (isProduction) {
    nodeRollupConfig.output.file = `dist/applicationinsights-web.min.js`;
    nodeRollupConfig.plugins.push(
      uglify({
        ie8: true,
        output: {
          preamble: banner
        }
      })
    );
  }

  return nodeRollupConfig;
};

updateDistEsmFiles();

export default [
  nodeUmdRollupConfigFactory(true),
  nodeUmdRollupConfigFactory(false),
  browserRollupConfigFactory(true),
  browserRollupConfigFactory(false),
  browserRollupConfigFactory(true, version),
  browserRollupConfigFactory(false, version)
];