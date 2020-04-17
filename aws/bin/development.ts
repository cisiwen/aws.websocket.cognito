import cdk = require('@aws-cdk/core');
import { Environment } from '@aws-cdk/core';
import { IWebsocketStackSetting, WebSocketStack } from '../lib/websocket';
const envSydney: Environment = { region: 'ap-southeast-2', account: "822618848665" };
const app = new cdk.App();

const setting: IWebsocketStackSetting = {
    projectName: "liveAdminController-WebSocket",
    environment: "development",
    environmentShort: "dev",
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
const api: WebSocketStack = new WebSocketStack(app, `Dev-${setting.projectName}`, setting, { env: envSydney, description: "Live streaming controller websocket staging", tags: getTagging("Development") });