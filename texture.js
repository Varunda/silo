const fs = require("fs");

const assetPath = "D:\\Planetside2\\Resources\\Live-2021-04-28\\unpacked";

function getAssetPath(name) {
    const files = fs.readdirSync(assetPath);
    const lower = name.toLowerCase();

    //console.log(`looking for ${lower}`);

    for (const dir of files) {
        //console.log(dir);
        if (dir.startsWith("assets") == false) {
            continue;
        }

        const inDir = fs.readdirSync(assetPath + "/" + dir);
        //console.log(`Have ${inDir.length} files in ${dir}`);

        for (const file of inDir) {
            //console.log(`${file.toLowerCase()}`);
            if (file.toLowerCase() == lower) {
                return `${assetPath}/${dir}/${file}`;
            }
        }
    }

    return null;
}

exports.getAssetPath = getAssetPath;
