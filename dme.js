const Materials = require("./materials_3");
const MaterialParameters = require("./materialparams").MaterialParameters;
const Jenkins = require("hash-jenkins");

const D3DXPARAMETER_TYPE = {
    D3DXPT_VOID:              0,
    D3DXPT_BOOL:              1,
    D3DXPT_INT:               2,
    D3DXPT_FLOAT:             3,
    D3DXPT_STRING:            4,
    D3DXPT_TEXTURE:           5,
    D3DXPT_TEXTURE1D:         6,
    D3DXPT_TEXTURE2D:         7,
    D3DXPT_TEXTURE3D:         8,
    D3DXPT_TEXTURECUBE:       9,
    D3DXPT_SAMPLER:           10,
    D3DXPT_SAMPLER1D:         11,
    D3DXPT_SAMPLER2D:         12,
    D3DXPT_SAMPLER3D:         13,
    D3DXPT_SAMPLERCUBE:       14,
    D3DXPT_PIXELSHADER:       15,
    D3DXPT_VERTEXSHADER:      16,
    D3DXPT_PIXELFRAGMENT:     17,
    D3DXPT_VERTEXFRAGMENT:    18,
    D3DXPT_UNSUPPORTED:       19,
    D3DXPT_FORCE_DWORD:       0x7fffffff
};

const D3DXPARAMETER_CLASS = {
    D3DXPC_SCALAR:            0,
    D3DXPC_VECTOR:            1,
    D3DXPC_MATRIX_ROWS:       2,
    D3DXPC_MATRIX_COLUMNS:    3,
    D3DXPC_OBJECT:            4,
    D3DXPC_STRUCT:            5,
    D3DXPC_FORCE_DWORD:       0x7fffffff
};

const InputLayoutEntrySizes = {
    "Float3":       12,
    "D3dcolor":     4,
    "Float2":       8,
    "Float4":       16,
    "ubyte4n":      4,
    "Float16_2":    4,
    "float16_2":    4,
    "Short2":       4,
    "Float1":       4,
    "Short4":       8
};

function readInputLayoutEntry(type, data, offset) {
    let result;
    switch (type) {
        case "Float3":
            result = [
                data.readFloatLE(offset),
                data.readFloatLE(offset+4),
                data.readFloatLE(offset+8)
            ];
            break;

        case "D3dcolor":
            result = data.readUInt32LE(offset);
            break;

        case "Float2":
            result = [
                data.readFloatLE(offset),
                data.readFloatLE(offset+4),
            ];
            break;

        case "Float4":
            result = [
                data.readFloatLE(offset),
                data.readFloatLE(offset+4),
                data.readFloatLE(offset+8),
                data.readFloatLE(offset+12)
            ];
            break;

        case "ubyte4n":
            result = [
                (data.readUInt8(offset) / 255 * 2) - 1,
                (data.readUInt8(offset+1) / 255 * 2) - 1,
                (data.readUInt8(offset+2) / 255 * 2) - 1,
                (data.readUInt8(offset+3) / 255 * 2) - 1
            ];
            break;

        case "Float16_2":
        case "float16_2":
            result = [
                readFloat16LE(data, offset),
                readFloat16LE(data, offset+2)
            ];
            break;

        case "Short2":
            result = [
                data.readUInt16LE(offset),
                data.readUInt16LE(offset+2)
            ];
            break;

        case "Float1":
            result = data.readFloatLE(offset);
            break;

        case "Short4":
            result = [
                data.readUInt16LE(offset),
                data.readUInt16LE(offset+2),
                data.readUInt16LE(offset+4),
                data.readUInt16LE(offset+6)
            ];
            break;

        default:
            break;
    }

    return result;
}

function parseParameter(param, data) {
    let value;

    switch (param.type) {
        case D3DXPARAMETER_TYPE.D3DXPT_VOID:
            value = null;
            break;

        case D3DXPARAMETER_TYPE.D3DXPT_BOOL:
            value = data.readUInt32LE(0) != 0;
            break;

        case D3DXPARAMETER_TYPE.D3DXPT_INT:
            value = data.readUInt32LE(0);
            break;

        case D3DXPARAMETER_TYPE.D3DXPT_FLOAT:
            value = data.readFloatLE(0);
            break;

        case D3DXPARAMETER_TYPE.D3DXPT_STRING:
            value = data.toString();
            break;

        case D3DXPARAMETER_TYPE.D3DXPT_TEXTURE:
            value = data.readUInt32LE(0);
            break;

        default:
            throw "Unhandled parameter type:" + param.type;
    }

    return value;
}

function parseMaterial(material, data) {
    let offset = 0;

    material.definition = data.readUInt32LE(offset);
    offset += 4;

    if (Materials.MaterialDefinitions[material.definition]) {
        const matdef = Materials.MaterialDefinitions[material.definition];
        material.name = matdef.name;
    }

    let numParams = data.readUInt32LE(offset);
    offset += 4;

    material.parameters = [];

    for (let i = 0; i < numParams; i++) {
        let param = {};

        param.hash = data.readUInt32LE(offset);
        offset += 4;

        param.name = null;
        if (MaterialParameters[param.hash]) {
            param.name = MaterialParameters[param.hash].name;
        }

        param.class = data.readUInt32LE(offset);
        offset += 4;

        param.type = data.readUInt32LE(offset);
        offset += 4;

        let paramDataLength = data.readUInt32LE(offset);
        offset += 4;

        let paramData = data.slice(offset, paramDataLength + offset);
        offset += paramDataLength;

        param.value = parseParameter(param, paramData);

        material.parameters.push(param);
    }
}

function readVector3(data, offset) {
    var v = {
        x: data.readFloatLE(offset),
        y: data.readFloatLE(offset + 4),
        z: data.readFloatLE(offset + 8)
    };
    return v;
}

function readFloat16LE(data, offset) {
    const v = data.readUInt16LE(offset);
    const sign = (v >> 15) ? -1 : 1;
    const expo = (v >> 10) & 0x1F;
    if (expo == 0x1F) {
        //console.log(`INF`);
    }
    const mantissa = v & 0x3FF;
    const fraction = mantissa / 1024;
    const f = sign * Math.pow(2, expo - 15) * (1 + fraction);
    //console.log(`${v.toString(16)} / ${f}`);
    return f;
}

function readDMAT(data) {
    var dmat = {},
        texLength, texData,
        material, matLength, matData,
        i, offset = 0;

    dmat.magic = data.readUInt32LE(offset);
    offset += 4;

    if (dmat.magic != 0x54414D44) {
        throw "Not a DMAT file";
    }

    dmat.version = data.readUInt32LE(offset);
    offset += 4;

    texLength = data.readUInt32LE(offset);
    offset += 4;

    texData = data.slice(12, texLength + 12 - 1);
    offset += texLength;

    dmat.textures = texData.toString().split("\0");

    dmat.numMaterials = data.readUInt32LE(offset);
    offset += 4;

    dmat.materials = [];

    for (i = 0; i < dmat.numMaterials; i++) {
        material = {};

        material.nameHash = data.readUInt32LE(offset);
        offset += 4;

        matLength = data.readUInt32LE(offset);
        offset += 4;

        matData = data.slice(offset, matLength + offset);
        offset += matLength;

        parseMaterial(material, matData);

        dmat.materials.push(material);
    }

    return dmat;
}

function writeDMAT(model) {
    var magic = "DMAT",
        version = 1,
        numTextures = model.textures.length,
        textureData = model.textures.join("\0") + "\0",
        numMaterials = model.materials.length;

    var dataSize = 4 + 4 + textureData.length + 4;
}

function writeDME(model) {
    var dmat = writeDMAT(model);
}

function normalize(v) {
    var v0 = v[0],
        v1 = v[1],
        v2 = v[2],
        len = Math.sqrt(v0*v0 + v1*v1 + v2*v2);
    if (len > 0) {
        v0 /= len;
        v1 /= len;
        v2 /= len;
    }
    return [v0,v1,v2];
}

function readDME(data) {
    let dmod = {};
    let dmatLength;
    let dmatData;
    let offset = 0;

    dmod.magic = data.readUInt32LE(offset);
    offset += 4;

    if (dmod.magic != 0x444F4D44) {
        throw "Not a DMOD file";
    }

    dmod.version = data.readUInt32LE(offset);
    offset += 4;

    if (dmod.version != 4) {
        throw "Unsupported DMOD version: " + dmod.version;
    }

    dmatLength = data.readUInt32LE(offset);
    offset += 4;

    dmatData = data.slice(offset, offset + dmatLength);
    dmod.dmat = readDMAT(dmatData);
    console.log("dmat", dmod.dmat);

    offset += dmatLength;

    if (dmod.dmat.materials.length == 0) {
        throw "No materials in DME file";
    }

    const material = dmod.dmat.materials[0];
    const matdef = Materials.MaterialDefinitions[material.definition];

    if (!matdef) {
        throw "Unknown material definition: " + material.definition;
    }
    if (matdef.drawStyles.length == 0) {
        throw "No draw styles for material definition";
    }

    const drawStyle = matdef.drawStyles[0];
    const inputLayout = Materials.InputLayouts[Jenkins.oaat(drawStyle.inputLayout)];

    if (!inputLayout) {
        throw `Input layout not found: ${drawStyle.inputLayout}/${Jenkins.oaat(drawStyle.inputLayout)}`;
    }

    dmod.aabb = {
        min: readVector3(data, offset),
        max: readVector3(data, offset + 12)
    };

    offset += 24;

    const numMeshes = data.readUInt32LE(offset);
    offset += 4;

    dmod.meshes = [];
    let drawCallOffset, drawCallCount,
        boneTransformCount, numVertexStreams,
        indexFlags, indexSize, numIndices, numVertices;

    console.log(`numMeshes: ${numMeshes}`);

    for (let i = 0; i < numMeshes; i++) {
        console.log(`Reading mesh ${i}`);
        const mesh = {};

        drawCallOffset = data.readUInt32LE(offset);
        drawCallCount = data.readUInt32LE(offset + 4);
        boneTransformCount = data.readUInt32LE(offset + 8);
        numVertexStreams = data.readUInt32LE(offset + 16);
        indexFlags = data.readUInt32LE(offset + 20);
        indexSize = indexFlags & 0x0F;
        numIndices = data.readUInt32LE(offset + 24);
        numVertices = data.readUInt32LE(offset + 28);

        offset += 32;

        console.log("\tdrawCallOffset", drawCallOffset);
        console.log("\tdrawCallCount", drawCallCount);
        console.log("\tboneTransformCount", boneTransformCount);
        console.log("\tnumVertexStreams", numVertexStreams);
        console.log("\tindexSize", indexSize, indexSize.toString(16));
        console.log("\tindexFlags", indexFlags, indexFlags.toString(16));
        console.log("\tnumIndices", numIndices, numIndices.toString(16));
        console.log("\tnumVertices", numVertices, numVertices.toString(16));

        var vertices = [],
            uvs = [[]],
            normals = [],
            binormals = [],
            tangents = [],
            vertexStreams = [],
            skinIndices = [],
            skinWeights = [];

        // Vertex streams
        for (let j = 0; j < numVertexStreams; j++) {
            const stride = data.readUInt32LE(offset);
            offset += 4;
            vertexStreams[j] = {
                stride: stride,
                data: data.slice(offset, offset + numVertices * stride),
                offset: 0,
                originalOffset: offset
            };
            offset += stride * numVertices;
            console.log(`\tvertex stream: ${j},`
                + ` stride: ${vertexStreams[j].stride},`
                + ` data: ${vertexStreams[j].data.length},`
                + ` offset: ${vertexStreams[j].originalOffset}`);
        }

        for (var j = 0; j < numVertices; j++) {
            for (var k = 0; k < numVertexStreams; k++) {
                vertexStreams[k].offset = 0;
            }

            for (let k = 0; k < inputLayout.entries.length; k++) {
                const entry = inputLayout.entries[k];
                const stream = vertexStreams[entry.stream];

                if (stream.offset >= stream.stride) {
                    continue;
                }

                const value = readInputLayoutEntry(entry.type, stream.data, stream.stride * j + stream.offset);

                switch (entry.usage) {
                    case "Position":
                        vertices.push(value);
                        break;

                    case "Normal":
                        normals.push(value);
                        break;

                    case "Binormal":
                        binormals.push(value);
                        break;

                    case "Tangent":
                        tangents.push(value);
                        break;

                    case "BlendWeight":
                        skinWeights.push(value);
                        break;

                    case "BlendIndices":
                        skinIndices.push([
                            value & 0xFF,
                            (value >> 8) & 0xFF,
                            (value >> 16) & 0xFF,
                            (value >> 24) & 0xFF
                        ]);
                        break;

                    case "Texcoord":
                        if (!uvs[entry.usageIndex]) {
                            uvs[entry.usageIndex] = [];
                        }
                        uvs[entry.usageIndex].push(value);
                        break;
                }
                stream.offset += InputLayoutEntrySizes[entry.type];
            }

        }

        for (let k = 0; k < numVertexStreams; k++) {
            console.log(`vertexStream ${k}, offset: ${vertexStreams[k].offset}`);
        }

        // calculate normals if we don't have them but do have binormals and tangent
        if (normals.length == 0 && binormals.length > 0 && tangents.length > 0) {
            for (let j = 0; j < numVertices; j++) {
                const b = normalize(binormals[j]);
                const t = normalize(tangents[j]);
                const sign = -tangents[j][3];
                let n = [
                    b[1] * t[2] - b[2] * t[1],
                    b[2] * t[0] - b[0] * t[2],
                    b[0] * t[1] - b[1] * t[0]
                ];
                n = normalize(n);
                n[0] *= sign;
                n[1] *= sign;
                n[2] *= sign;
                normals.push(n);
            }
        }

        mesh.vertices = vertices;
        //mesh.normals = normals;
        //mesh.binormals = binormals;
        mesh.uvs = uvs;
        mesh.influencesPerVertex = 1;
        mesh.skinWeights = skinWeights;
        mesh.skinIndices = skinIndices;

        // Indices
        const indices = [];
        for (let j = 0; j < numIndices; j += 3) {
            if (indexSize == 2) {
                indices.push(
                    data.readUInt16LE(offset),
                    data.readUInt16LE(offset+2),
                    data.readUInt16LE(offset+4)
                );
            } else if (indexSize == 4) {
                indices.push(
                    data.readUInt32LE(offset),
                    data.readUInt32LE(offset+4),
                    data.readUInt32LE(offset+8)
                );
            }
            offset += indexSize * 3;
        }
        mesh.indexSize = indexSize;
        mesh.indices = indices;

        if (boneTransformCount > 0) {
            const boneMapEntryCount = data.readUInt32LE(offset);
            offset += 4;
            mesh.boneMapEntries = [];
            console.log(`boneMapEntryCount: ${boneMapEntryCount}/${boneMapEntryCount.toString(16)}`);
            for (let j = 0; j < boneMapEntryCount; j++) {
                const boneMapEntry = {};
                boneMapEntry.boneIndex = data.readUInt16LE(offset);
                offset += 2;
                boneMapEntry.globalIndex = data.readUInt16LE(offset);
                offset += 2;
                mesh.boneMapEntries.push(boneMapEntry);
            }

            const boneCount = data.readUInt32LE(offset);
            offset += 4;
            console.log(`boneCount: ${boneCount}/${boneCount.toString(16)}`);

            mesh.bones = [];
            for (let j = 0; j < boneCount; j++) {
                const bone = {};
                bone.inverseBindPose = [
                    data.readFloatLE(offset), data.readFloatLE(offset+4), data.readFloatLE(offset+8), 0,
                    data.readFloatLE(offset+12), data.readFloatLE(offset+16), data.readFloatLE(offset+20), 0,
                    data.readFloatLE(offset+24), data.readFloatLE(offset+28), data.readFloatLE(offset+32), 0,
                    data.readFloatLE(offset+36), data.readFloatLE(offset+40), data.readFloatLE(offset+44), 1
                ];
                offset += 48;
                mesh.bones.push(bone);
            }

            for (let j = 0; j < boneCount; j++) {
                const bone = mesh.bones[j];
                bone.bbox = [
                    data.readFloatLE(offset), data.readFloatLE(offset+4), data.readFloatLE(offset+8),
                    data.readFloatLE(offset+12), data.readFloatLE(offset+16), data.readFloatLE(offset+20)
                ];
                offset += 24;
            }

            for (let j = 0; j < boneCount; j++) {
                const bone = mesh.bones[j];
                bone.nameHash = data.readUInt32LE(offset);
                offset += 4;
            }
        }

        /*
        var drawCallCount = data.readUInt32LE(offset);
        console.log("drawCallCount", drawCallCount);
        mesh.drawCalls = [];
        offset += 4;
        for (var j=0;j<drawCallCount;j++) {
            var drawCall = {};
            drawCall.unknown0 = data.readUInt32LE(offset);
            offset += 4;
            drawCall.boneStart = data.readUInt32LE(offset);
            offset += 4;
            drawCall.boneCount = data.readUInt32LE(offset);
            offset += 4;
            drawCall.delta = data.readUInt32LE(offset);
            offset += 4;
            drawCall.unknown1 = data.readUInt32LE(offset);
            offset += 4;
            drawCall.vertexOffset = data.readUInt32LE(offset);
            offset += 4;
            drawCall.vertexCount = data.readUInt32LE(offset);
            offset += 4;
            drawCall.indexOffset = data.readUInt32LE(offset);
            offset += 4;
            drawCall.indexCount = data.readUInt32LE(offset);
            offset += 4;

            mesh.drawCalls.push(drawCall);
        }
        */

        dmod.meshes.push(mesh);
    }

    console.log(offset);

    return dmod;
}

exports.write = writeDME;
exports.read = readDME;
exports.Materials = Materials;
exports.InputLayouts = Materials.InputLayouts;
exports.MaterialDefinitions = Materials.MaterialDefinitions;
exports.MaterialParameters = MaterialParameters;

