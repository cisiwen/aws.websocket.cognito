import cdk = require('@aws-cdk/core');
import { Environment } from '@aws-cdk/core';
import { IWebsocketStackSetting, WebSocketStack } from '../lib/websocket';
const envSydney: Environment = { region: 'ap-southeast-2', account: "673536892860" };
const app = new cdk.App();

const setting: IWebsocketStackSetting = {
    projectName: "liveStreamControllerWebSocket",
    environment: "staging",
    environmentShort: "staging",
    codeSource: "./dist/src"
};

function getTagging(env: string): { [key: string]: string } {
    let tags: { [key: string]: string } = {
        Name: "LiveAdmin",
        Environment: env,
        Owner: "CloudVideo",
        CostCentre: "CloudVideo",
        Project: "LiveAdmin",
        Function: "Websocket"
    }
    return tags;
}
const api: WebSocketStack = new WebSocketStack(app, "Staging-LiveStreamController-Websocket", setting, { env: envSydney, description: "Live streaming controller websocket staging", tags: getTagging("Staging") });