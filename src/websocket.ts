import * as AWS from "aws-sdk";
import { APIGatewayEvent, APIGatewayProxyResult, PolicyDocument, APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerCallback, APIGatewayAuthorizerResult } from "aws-lambda";
import { PutItemInput, DeleteItemInput } from "aws-sdk/clients/dynamodb";
import jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
import fs = require("fs");
class WebSocketServer {
    private db: AWS.DynamoDB.DocumentClient;
    private tableName: string;
    constructor() {
        this.db = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
        if (process.env.TABLE_NAME) {
            this.tableName = process.env.TABLE_NAME;
        }
        else {

        }
    }

    private log(requestId: string, callee: string, input: any, output?: any, process?: string, result?: boolean, ) {
        console.log({ requestId, callee, input, output, result })
    }
    private validateRequest(event: APIGatewayEvent): APIGatewayProxyResult {
        return event.requestContext?.connectionId ? { statusCode: 200, body: "" } : { statusCode: 500, body: 'Bad request: ' + JSON.stringify(new Error("Invalid connection")) };
    }

    private generatePolicy(principalId: string, effect: string, resource: string): APIGatewayAuthorizerResult {

        let policy: PolicyDocument = {
            Version: "2012-10-17",
            Statement: [{
                Effect: effect,
                Action: "execute-api:Invoke",
                Resource: resource
            }]
        }
        let authResponse: APIGatewayAuthorizerResult = {
            principalId: principalId,
            policyDocument: policy,
            context: {
                stringKey: "stringval",
                numberKey: 123,
                booleanKey: true
            }
        }
        return authResponse;

    }

    async onConnect(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
        this.log(event.requestContext.requestId, this.onConnect.name, event);
        const validateResult = this.validateRequest(event);
        if (validateResult.statusCode === 200) {
            const putParams: PutItemInput = {
                TableName: this.tableName,
                Item: {
                    connectionId: { S: event?.requestContext?.connectionId }
                }
            }
            try {
                await this.db.put(putParams).promise();
                return { statusCode: 200, body: 'Connected.' };
            }
            catch (err) {
                return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
            }
        }
        else {
            this.log(event.requestContext.requestId, this.onConnect.name, event, validateResult, this.validateRequest.name, false);
            return validateResult;
        }
    }

    async onDisconnect(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
        this.log(event.requestContext.requestId, this.onDisconnect.name, event);
        const validateResult = this.validateRequest(event);
        if (validateResult.statusCode === 200) {
            const deleteParams: DeleteItemInput = {
                TableName: this.tableName,
                Key: {
                    connectionId: { S: event.requestContext.connectionId }
                }
            };
            try {
                await this.db.delete(deleteParams).promise();
                return { statusCode: 200, body: 'Disconnected.' };
            }
            catch (err) {
                return { statusCode: 500, body: 'Failed to disconnect: ' + JSON.stringify(err) };
            }
        }
        else {
            return validateResult;
        }
    }

    async onMessage(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
        this.log(event.requestContext.requestId, this.onMessage.name, event);
        const validateResult = this.validateRequest(event);
        if (validateResult.statusCode !== 200) return validateResult;
        let connectionData;
        try {
            connectionData = await this.db.scan({ TableName: this.tableName, ProjectionExpression: 'connectionId' }).promise();
        } catch (e) {
            return { statusCode: 500, body: e.stack };
        }

        const apigwManagementApi = new AWS.ApiGatewayManagementApi({
            apiVersion: '2018-11-29',
            endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
        });

        if (event.body) {
            const postData = JSON.parse(event.body).data;
            const postCalls = connectionData?.Items?.map(async ({ connectionId }) => {
                try {
                    await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: postData }).promise();
                } catch (e) {
                    if (e.statusCode === 410) {
                        console.log(`Found stale connection, deleting ${connectionId}`);
                        await this.db.delete({ TableName: this.tableName, Key: { connectionId } }).promise();
                    } else {
                        throw e;
                    }
                }
            });

            try {
                if (postCalls) {
                    await Promise.all(postCalls);
                }
            } catch (e) {
                return { statusCode: 500, body: e.stack };
            }
            return { statusCode: 200, body: 'Data sent.' };
        }
        else {
            return { statusCode: 500, body: "Empty message" };
        }
    }

    async authorizer(event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {

        //https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
        this.log(event.requestContext?.requestId, this.authorizer.name, event);
        return new Promise((ok, fail) => {
            let token = event?.queryStringParameters?.token;
            if (token) {
                let jwk = JSON.parse(fs.readFileSync(`/assets/${process.env.ENVIRONMENT}.jwk`.toLowerCase()).toString());
                const pem = jwkToPem(jwk);
                jwt.verify(token, pem, (err: any, decoded: any) => {
                    if (err) {
                        this.log(event.requestContext?.requestId, this.authorizer.name, event, err, "verify", false);
                        ok(this.generatePolicy("User", "Deny", event.methodArn));
                    }
                    else {
                        ok(this.generatePolicy("User", "Allow", event.methodArn));
                    }

                });
            }
            else {
                ok(this.generatePolicy("User", "Deny", event.methodArn));
            }
        });
    }
}

const websocket = new WebSocketServer();
module.exports.onConnect = websocket.onConnect.bind(websocket);
module.exports.onDisconnect = websocket.onDisconnect.bind(websocket);
module.exports.onMessage = websocket.onMessage.bind(websocket);
module.exports.authorizer = websocket.authorizer.bind(websocket);