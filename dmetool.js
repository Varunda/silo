#!/usr/bin/env node

var DME = require("./dme.js"),
    Jenkins = require("hash-jenkins"),
    xml2js = require("xml2js"),
    fs = require("fs"),
    path = require("path");

const { program } = require("commander");
const texture = require("./texture.js");

program
    .name("dme-tool")
    .description("turn .dme files into .obj files")
    .requiredOption("-i, --input <input file>", "file input")
    .requiredOption("-o, --output <output file/directory>", "where the output will be placed")
    .option("-m, --matdef <materials json>", "What file is used for the material definitions")
    .option("-t, --texturedir <folder>", "What directory has all the textures")
    .option("-v, --verbose", "Enable more output")
    ;

program
    .command("info")
    .description("Display basic info about the DME");

program.command("obj").description("Convert a .dme file into a .obj file");
program.command("mat").description("Export the materials of a .dme file");
program.command("both").description("Performed both the obj and mat command on the input .dme file");
program.command("json").description("Export a .dme file into a .JSON file");
program.command("matdef").description("Turn the input file into the materials definition json file");

program.parse();

/*
function usage() {
    console.log("Usage: ./dmetool.js <mode> <inPath> [<outPath>]");
    console.log("Modes: info     Display basic info about the DME");
    console.log("       obj      Export model to OBJ");
    console.log("       mat      Export the textures/materials of a .dme file");
    console.log("       both     Export both the model to OBJ, and the materials in the .dme file");
    console.log("       json     Export model to JSON");
    console.log("       matdef   Read materials_3.xml and export definitions to JSON");
}
*/

if (program.opts().verbose) {
    console.log("Options passed:");
    console.log(program.opts());
}
//console.log(program);

const assetPath = "D:\\Planetside2\\Resources\\Live-2021-04-28\\unpacked";

function toJSON(dme) {
    var model = {
        "metadata": { "formatVersion" : 3 },

        "materials": [ {
            "DbgColor" : 15658734, // => 0xeeeeee
            "DbgIndex" : 0,
            "DbgName" : "dummy",
            "colorDiffuse" : [ 1, 0, 0 ],
        }],

        "vertices": [],
        "uvs":      [[]],
        "faces": []
    };

    var mesh = dme.meshes[0];
    for (var j=0,l=mesh.vertices.length;j<l;j++) {
        var vertex = mesh.vertices[j];
        model.vertices.push(
            vertex[0],
            vertex[1],
            vertex[2]
        );
    }

    var uvs = mesh.uvs[0];
    for (var j=0,l=uvs.length;j<l;j++) {
        var uv = uvs[j];
        model.uvs[0].push(
            uv[0], uv[1]
        );
    }

    for (var j=0,l=mesh.indices.length;j<l;j+=3) {
        model.faces.push(
            10,
            mesh.indices[j],
            mesh.indices[j+1],
            mesh.indices[j+2],
            0,
            mesh.indices[j],
            mesh.indices[j+1],
            mesh.indices[j+2]
        );
    }

    return model;
}

function toOBJ(dme) {
    var obj = [];
    console.log(`meshes in dme: ${dme.meshes.length}`);
    for (let i = 0; i < dme.meshes.length; i++) {
        obj.push("\ng Mesh " + i);
        const mesh = dme.meshes[i];
        for (let j = 0, l = mesh.vertices.length; j < l; j++) {
            const vertex = mesh.vertices[j];
            obj.push(
                "v " + vertex[0].toPrecision(7) + " " + vertex[1].toPrecision(7) + " " + vertex[2].toPrecision(7)
            );
        }
        /*
        for (var j=0,l=mesh.normals.length;j<l;j++) {
            var normal = mesh.normals[j];
            obj.push(
                "vn " + normal[0] + " " + normal[1] + " " + normal[2]
            );
        }
        */
        const uvs = mesh.uvs[0];
        for (var j = 0, l = uvs.length; j < l; j++) {
            const uv = uvs[j];

            let tx = 0;
            let ty = 0;

            if (mesh.indexSize == 2) {
                tx = uv[0];
                ty = 1 - uv[1];
            } else if (mesh.indexSize == 4) {
                tx = uv[0];
                ty = 1 - uv[1];
            }

            obj.push(
                "vt " + tx.toFixed(6) + " " + ty.toFixed(6)
            );
        }

        for (let j = 0, l = mesh.indices.length; j < l; j += 3) {
            const v0 = mesh.indices[j] + 1,
                v1 = mesh.indices[j+1] + 1,
                v2 = mesh.indices[j+2] + 1;
            /*
            obj.push(
                "f " +
                    v0 + "/" + v0 + " " +
                    v1 + "/" + v1 + " " +
                    v2 + "/" + v2
            );
            */

            //obj.push(`f ${v1}/${v1} ${v0}/${v0} ${v2}/${v2}`);
            obj.push("f " + v1 + "/" + v1 + " " + v0 + "/" + v0 + " " + v2 + "/" + v2);
        }
    }
    return obj.join("\n");
}

const mode = process.argv[2];
const inPath = program.opts().input;

if (inPath) {
    if (!fs.existsSync(inPath)) {
        throw `inPath ${inPath} does not exist`;
    }

    switch (mode) {
        case "obj":
            handleObj();
            break;

        case "mat": {
            handleMat();
            break;
        }

        case "both": {
            handleObj();
            handleMat();
            break;
        }

        case "json": {
            console.log("Reading DME data from " + inPath);
            const data = fs.readFileSync(inPath),
                dme = DME.read(data),
                outPath = process.argv[4];

            if (!outPath) {
                outPath = "./";
            }
            if (!fs.existsSync(outPath)) {
                throw "outPath does not exist";
            }

            const obj = toJSON(dme);
            const objPath = path.join(outPath, path.basename(inPath, ".dme") + ".json");

            console.log("Writing JSON data to " + objPath);
            fs.writeFileSync(objPath, JSON.stringify(obj, null, 4));
            break;
        }

        case "info": {
            console.log("Reading DME data from " + inPath);
            const data = fs.readFileSync(inPath),
                dme = DME.read(data);

            for (var i=0;i<dme.meshes.length;i++) {
                var mesh = dme.meshes[i];
                console.log("Vertices: " + mesh.vertices.length);
                console.log(mesh);
                if (mesh.drawCalls) {
                    for (let j = 0; j < mesh.drawCalls.length; j++) {
                        console.log("Drawcall: "
                            + mesh.drawCalls[j].vertexCount + " vertices, "
                            + mesh.drawCalls[j].indexCount + " indices"
                        );
                    }
                }
            }
            //console.log(JSON.stringify(dme, null, 2));

            break;
        }

        case "matdef": {
            console.log("Reading material definitions from " + inPath);
            const data = fs.readFileSync(inPath);
              let outPath = process.argv[4];

            if (!outPath) {
                outPath = path.basename(inPath, ".xml") + ".js";
            }

            xml2js.parseString(data.toString("utf-8"), function(err, result) {
                console.log("Writing material definitions to " + outPath);

                var inputLayouts = {},
                    materialDefinitions = {},
                    nodes = result.Object.Array,
                    obj;
                for (var i=0;i<nodes.length;i++) {
                    if (nodes[i].$.Name == "InputLayouts") {
                        var inputLayoutNodes = nodes[i].Object;
                        for (var j=0;j<inputLayoutNodes.length;j++) {
                            var layout = {
                                name: inputLayoutNodes[j].$.Name,
                                entries: []
                            };
                            var entryNodes = inputLayoutNodes[j].Array[0].Object;
                            for (var k=0;k<entryNodes.length;k++) {
                                var entry = {
                                    stream: +entryNodes[k].$.Stream,
                                    type: entryNodes[k].$.Type,
                                    usage: entryNodes[k].$.Usage,
                                    usageIndex: +entryNodes[k].$.UsageIndex
                                };
                                layout.entries.push(entry);
                            }
                            inputLayouts[Jenkins.oaat(layout.name)] = layout;
                        }
                    } else if (nodes[i].$.Name == "MaterialDefinitions") {
                        var matDefNodes = nodes[i].Object;
                        for (var j=0;j<matDefNodes.length;j++) {
                            var matDef = {
                                name: matDefNodes[j].$.Name,
                                hash: Jenkins.oaat(matDefNodes[j].$.Name),
                                drawStyles: []
                            };
                            if (matDefNodes[j].Array) {
                                for (var n=0;n<matDefNodes[j].Array.length;n++) {
                                    if (matDefNodes[j].Array[n].$.Name == "DrawStyles") {
                                        var drawStyleNodes = matDefNodes[j].Array[n].Object;
                                        for (var k=0;k<drawStyleNodes.length;k++) {
                                            var drawStyle = {
                                                name: drawStyleNodes[k].$.Name,
                                                hash: Jenkins.oaat(drawStyleNodes[k].$.Name),
                                                inputLayout: drawStyleNodes[k].$.InputLayout
                                            };
                                            matDef.drawStyles.push(drawStyle);
                                        }
                                    }
                                }
                                materialDefinitions[Jenkins.oaat(matDef.name)] = matDef;
                            }
                        }
                    }
                }

                var obj = {
                    inputLayouts: inputLayouts,
                    materialDefinitions: materialDefinitions
                };

                fs.writeFileSync(outPath, [
                    "var data = " + JSON.stringify(obj, null, 4) + ";",
                    "exports.InputLayouts = data.inputLayouts;",
                    "exports.MaterialDefinitions = data.materialDefinitions;"
                ].join("\n"));
            });
            break;
        }

        default:
            usage();
    }
} else {
    usage();
}

function handleObj() {
    console.log("Reading DME data from " + inPath);
    const data = fs.readFileSync(inPath);
    const dme = DME.read(data);
    let outPath = getOutputPath(inPath);

    const obj = toOBJ(dme);
    const objPath = path.join(outPath, path.basename(inPath, ".dme") + ".obj");

    console.log("Writing OBJ data to " + objPath);
    fs.writeFileSync(objPath, obj);
}

function handleMat() {
    console.log(`Reading DME from ${inPath}`);
    const data = fs.readFileSync(inPath);
    const dme = DME.read(data);
    let outPath = getOutputPath(inPath);

    const textures = dme.dmat.textures;//.filter(iter => iter.indexOf("_C.dds") > -1);

    for (const tex of textures) {
        const texx = texture.getAssetPath(tex);
        if (texx != null) {
            console.log(texx);
            fs.copyFileSync(texx, outPath + "/" + tex);
        }
    }
}

function getOutputPath(inPath) {
    if (!inPath) {
        throw `Missing inPath`;
    }

    let outPath = program.opts().output;

    if (!outPath) {
        outPath = `./${path.basename(inPath, ".dme")}`;
        if (!fs.existsSync(outPath)) {
            fs.mkdirSync(outPath);
        }
    }

    if (!fs.existsSync(outPath)) {
        throw `outPath ${outPath} does not exist`;
    }

    return outPath;
}

