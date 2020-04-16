rm dist -Recurse -Force
tsc -d false
cp -Recurse .\assets ./dist/src
cp package.json ./dist/src/
cd ./dist/src
npm install --production
cd ../../