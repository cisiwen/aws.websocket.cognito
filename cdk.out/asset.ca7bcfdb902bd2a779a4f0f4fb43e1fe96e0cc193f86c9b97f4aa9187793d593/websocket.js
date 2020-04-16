"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
const jwkToPem = require('jwk-to-pem');
const fs = require("fs");
class WebSocketServer {
    constructor() {
        this.db = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
        if (process.env.TABLE_NAME) {
            this.tableName = process.env.TABLE_NAME;
        }
        else {
        }
    }
    log(requestId, callee, input, output, process, result) {
        console.log({ requestId, callee, input, output, result });
    }
    validateRequest(event) {
        var _a;
        return ((_a = event.requestContext) === null || _a === void 0 ? void 0 : _a.connectionId) ? { statusCode: 200, body: "" } : { statusCode: 500, body: 'Bad request: ' + JSON.stringify(new Error("Invalid connection")) };
    }
    generatePolicy(principalId, effect, resource) {
        let policy = {
            Version: "2012-10-17",
            Statement: [{
                    Effect: effect,
                    Action: "execute-api:Invoke",
                    Resource: resource
                }]
        };
        let authResponse = {
            principalId: principalId,
            policyDocument: policy,
            context: {
                stringKey: "stringval",
                numberKey: 123,
                booleanKey: true
            }
        };
        return authResponse;
    }
    async onConnect(event) {
        var _a;
        this.log(event.requestContext.requestId, this.onConnect.name, event);
        const validateResult = this.validateRequest(event);
        if (validateResult.statusCode === 200) {
            const putParams = {
                TableName: this.tableName,
                Item: {
                    connectionId: { S: (_a = event === null || event === void 0 ? void 0 : event.requestContext) === null || _a === void 0 ? void 0 : _a.connectionId }
                }
            };
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
    async onDisconnect(event) {
        this.log(event.requestContext.requestId, this.onDisconnect.name, event);
        const validateResult = this.validateRequest(event);
        if (validateResult.statusCode === 200) {
            const deleteParams = {
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
    async onMessage(event) {
        var _a;
        this.log(event.requestContext.requestId, this.onMessage.name, event);
        const validateResult = this.validateRequest(event);
        if (validateResult.statusCode !== 200)
            return validateResult;
        let connectionData;
        try {
            connectionData = await this.db.scan({ TableName: this.tableName, ProjectionExpression: 'connectionId' }).promise();
        }
        catch (e) {
            return { statusCode: 500, body: e.stack };
        }
        const apigwManagementApi = new AWS.ApiGatewayManagementApi({
            apiVersion: '2018-11-29',
            endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
        });
        if (event.body) {
            const postData = JSON.parse(event.body).data;
            const postCalls = (_a = connectionData === null || connectionData === void 0 ? void 0 : connectionData.Items) === null || _a === void 0 ? void 0 : _a.map(async ({ connectionId }) => {
                try {
                    await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: postData }).promise();
                }
                catch (e) {
                    if (e.statusCode === 410) {
                        console.log(`Found stale connection, deleting ${connectionId}`);
                        await this.db.delete({ TableName: this.tableName, Key: { connectionId } }).promise();
                    }
                    else {
                        throw e;
                    }
                }
            });
            try {
                if (postCalls) {
                    await Promise.all(postCalls);
                }
            }
            catch (e) {
                return { statusCode: 500, body: e.stack };
            }
            return { statusCode: 200, body: 'Data sent.' };
        }
        else {
            return { statusCode: 500, body: "Empty message" };
        }
    }
    async authorizer(event) {
        var _a;
        //https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
        this.log((_a = event.requestContext) === null || _a === void 0 ? void 0 : _a.requestId, this.authorizer.name, event);
        return new Promise((ok, fail) => {
            var _a;
            let token = (_a = event === null || event === void 0 ? void 0 : event.queryStringParameters) === null || _a === void 0 ? void 0 : _a.token;
            if (token) {
                let jwk = JSON.parse(fs.readFileSync(`/assets/${process.env.ENVIRONMENT}.jwk`.toLowerCase()).toString());
                const pem = jwkToPem(jwk);
                jwt.verify(token, pem, (err, decoded) => {
                    var _a;
                    if (err) {
                        this.log((_a = event.requestContext) === null || _a === void 0 ? void 0 : _a.requestId, this.authorizer.name, event, err, "verify", false);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Vic29ja2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3dlYnNvY2tldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLCtCQUErQjtBQUcvQixvQ0FBcUM7QUFDckMsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3ZDLHlCQUEwQjtBQUMxQixNQUFNLGVBQWU7SUFHakI7UUFDSSxJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQzlFLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUU7WUFDeEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQztTQUMzQzthQUNJO1NBRUo7SUFDTCxDQUFDO0lBRU8sR0FBRyxDQUFDLFNBQWlCLEVBQUUsTUFBYyxFQUFFLEtBQVUsRUFBRSxNQUFZLEVBQUUsT0FBZ0IsRUFBRSxNQUFnQjtRQUN2RyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUE7SUFDN0QsQ0FBQztJQUNPLGVBQWUsQ0FBQyxLQUFzQjs7UUFDMUMsT0FBTyxPQUFBLEtBQUssQ0FBQyxjQUFjLDBDQUFFLFlBQVksRUFBQyxDQUFDLENBQUMsRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxlQUFlLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUM3SyxDQUFDO0lBRU8sY0FBYyxD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QUFDLENBQUM7cUJBQzdEO2dCQUVMLENBQUMsQ0FBQyxDQUFDO2FBQ047aUJBQ0k7Z0JBQ0QsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQzthQUM1RDtRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztDQUNKO0FBRUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztBQUN4QyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMvRCxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksR0FBRyxTQUFTLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNyRSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMvRCxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEFXUyBmcm9tIFwiYXdzLXNka1wiO1xyXG5pbXBvcnQgeyBBUElHYXRld2F5RXZlbnQsIEFQSUdhdGV3YXlQcm94eVJlc3VsdCwgUG9saWN5RG9jdW1lbnQsIEFQSUdhdGV3YXlSZXF1ZXN0QXV0aG9yaXplckV2ZW50LCBBUElHYXRld2F5QXV0aG9yaXplckNhbGxiYWNrLCBBUElHYXRld2F5QXV0aG9yaXplclJlc3VsdCB9IGZyb20gXCJhd3MtbGFtYmRhXCI7XHJcbmltcG9ydCB7IFB1dEl0ZW1JbnB1dCwgRGVsZXRlSXRlbUlucHV0IH0gZnJvbSBcImF3cy1zZGsvY2xpZW50cy9keW5hbW9kYlwiO1xyXG5pbXBvcnQgand0ID0gcmVxdWlyZSgnanNvbndlYnRva2VuJyk7XHJcbmNvbnN0IGp3a1RvUGVtID0gcmVxdWlyZSgnandrLXRvLXBlbScpO1xyXG5pbXBvcnQgZnMgPSByZXF1aXJlKFwiZnNcIik7XHJcbmNsYXNzIFdlYlNvY2tldFNlcnZlciB7XHJcbiAgICBwcml2YXRlIGRiOiBBV1MuRHluYW1vREIuRG9jdW1lbnRDbGllbnQ7XHJcbiAgICBwcml2YXRlIHRhYmxlTmFtZTogc3RyaW5nO1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5kYiA9IG5ldyBBV1MuRHluYW1vREIuRG9jdW1lbnRDbGllbnQoeyByZWdpb246IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfSk7XHJcbiAgICAgICAgaWYgKHByb2Nlc3MuZW52LlRBQkxFX05BTUUpIHtcclxuICAgICAgICAgICAgdGhpcy50YWJsZU5hbWUgPSBwcm9jZXNzLmVudi5UQUJMRV9OQU1FO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgbG9nKHJlcXVlc3RJZDogc3RyaW5nLCBjYWxsZWU6IHN0cmluZywgaW5wdXQ6IGFueSwgb3V0cHV0PzogYW55LCBwcm9jZXNzPzogc3RyaW5nLCByZXN1bHQ/OiBib29sZWFuLCApIHtcclxuICAgICAgICBjb25zb2xlLmxvZyh7IHJlcXVlc3RJZCwgY2FsbGVlLCBpbnB1dCwgb3V0cHV0LCByZXN1bHQgfSlcclxuICAgIH1cclxuICAgIHByaXZhdGUgdmFsaWRhdGVSZXF1ZXN0KGV2ZW50OiBBUElHYXRld2F5RXZlbnQpOiBBUElHYXRld2F5UHJveHlSZXN1bHQge1xyXG4gICAgICAgIHJldHVybiBldmVudC5yZXF1ZXN0Q29udGV4dD8uY29ubmVjdGlvbklkID8geyBzdGF0dXNDb2RlOiAyMDAsIGJvZHk6IFwiXCIgfSA6IHsgc3RhdHVzQ29kZTogNTAwLCBib2R5OiAnQmFkIHJlcXVlc3Q6ICcgKyBKU09OLnN0cmluZ2lmeShuZXcgRXJyb3IoXCJJbnZhbGlkIGNvbm5lY3Rpb25cIikpIH07XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVBvbGljeShwcmluY2lwYWxJZDogc3RyaW5nLCBlZmZlY3Q6IHN0cmluZywgcmVzb3VyY2U6IHN0cmluZyk6IEFQSUdhdGV3YXlBdXRob3JpemVyUmVzdWx0IHtcclxuXHJcbiAgICAgICAgbGV0IHBvbGljeTogUG9saWN5RG9jdW1lbnQgPSB7XHJcbiAgICAgICAgICAgIFZlcnNpb246IFwiMjAxMi0xMC0xN1wiLFxyXG4gICAgICAgICAgICBTdGF0ZW1lbnQ6IFt7XHJcbiAgICAgICAgICAgICAgICBFZmZlY3Q6IGVmZmVjdCxcclxuICAgICAgICAgICAgICAgIEFjdGlvbjogXCJleGVjdXRlLWFwaTpJbnZva2VcIixcclxuICAgICAgICAgICAgICAgIFJlc291cmNlOiByZXNvdXJjZVxyXG4gICAgICAgICAgICB9XVxyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgYXV0aFJlc3BvbnNlOiBBUElHYXRld2F5QXV0aG9yaXplclJlc3VsdCA9IHtcclxuICAgICAgICAgICAgcHJpbmNpcGFsSWQ6IHByaW5jaXBhbElkLFxyXG4gICAgICAgICAgICBwb2xpY3lEb2N1bWVudDogcG9saWN5LFxyXG4gICAgICAgICAgICBjb250ZXh0OiB7XHJcbiAgICAgICAgICAgICAgICBzdHJpbmdLZXk6IFwic3RyaW5ndmFsXCIsXHJcbiAgICAgICAgICAgICAgICBudW1iZXJLZXk6IDEyMyxcclxuICAgICAgICAgICAgICAgIGJvb2xlYW5LZXk6IHRydWVcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gYXV0aFJlc3BvbnNlO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBvbkNvbm5lY3QoZXZlbnQ6IEFQSUdhdGV3YXlFdmVudCk6IFByb21pc2U8QVBJR2F0ZXdheVByb3h5UmVzdWx0PiB7XHJcbiAgICAgICAgdGhpcy5sb2coZXZlbnQucmVxdWVzdENvbnRleHQucmVxdWVzdElkLCB0aGlzLm9uQ29ubmVjdC5uYW1lLCBldmVudCk7XHJcbiAgICAgICAgY29uc3QgdmFsaWRhdGVSZXN1bHQgPSB0aGlzLnZhbGlkYXRlUmVxdWVzdChldmVudCk7XHJcbiAgICAgICAgaWYgKHZhbGlkYXRlUmVzdWx0LnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgICBjb25zdCBwdXRQYXJhbXM6IFB1dEl0ZW1JbnB1dCA9IHtcclxuICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogdGhpcy50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICBJdGVtOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29ubmVjdGlvbklkOiB7IFM6IGV2ZW50Py5yZXF1ZXN0Q29udGV4dD8uY29ubmVjdGlvbklkIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5kYi5wdXQocHV0UGFyYW1zKS5wcm9taXNlKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdGF0dXNDb2RlOiAyMDAsIGJvZHk6ICdDb25uZWN0ZWQuJyB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN0YXR1c0NvZGU6IDUwMCwgYm9keTogJ0ZhaWxlZCB0byBjb25uZWN0OiAnICsgSlNPTi5zdHJpbmdpZnkoZXJyKSB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmxvZyhldmVudC5yZXF1ZXN0Q29udGV4dC5yZXF1ZXN0SWQsIHRoaXMub25Db25uZWN0Lm5hbWUsIGV2ZW50LCB2YWxpZGF0ZVJlc3VsdCwgdGhpcy52YWxpZGF0ZVJlcXVlc3QubmFtZSwgZmFsc2UpO1xyXG4gICAgICAgICAgICByZXR1cm4gdmFsaWRhdGVSZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIG9uRGlzY29ubmVjdChldmVudDogQVBJR2F0ZXdheUV2ZW50KTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+IHtcclxuICAgICAgICB0aGlzLmxvZyhldmVudC5yZXF1ZXN0Q29udGV4dC5yZXF1ZXN0SWQsIHRoaXMub25EaXNjb25uZWN0Lm5hbWUsIGV2ZW50KTtcclxuICAgICAgICBjb25zdCB2YWxpZGF0ZVJlc3VsdCA9IHRoaXMudmFsaWRhdGVSZXF1ZXN0KGV2ZW50KTtcclxuICAgICAgICBpZiAodmFsaWRhdGVSZXN1bHQuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGRlbGV0ZVBhcmFtczogRGVsZXRlSXRlbUlucHV0ID0ge1xyXG4gICAgICAgICAgICAgICAgVGFibGVOYW1lOiB0aGlzLnRhYmxlTmFtZSxcclxuICAgICAgICAgICAgICAgIEtleToge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbm5lY3Rpb25JZDogeyBTOiBldmVudC5yZXF1ZXN0Q29udGV4dC5jb25uZWN0aW9uSWQgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5kYi5kZWxldGUoZGVsZXRlUGFyYW1zKS5wcm9taXNlKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdGF0dXNDb2RlOiAyMDAsIGJvZHk6ICdEaXNjb25uZWN0ZWQuJyB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN0YXR1c0NvZGU6IDUwMCwgYm9keTogJ0ZhaWxlZCB0byBkaXNjb25uZWN0OiAnICsgSlNPTi5zdHJpbmdpZnkoZXJyKSB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gdmFsaWRhdGVSZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIG9uTWVzc2FnZShldmVudDogQVBJR2F0ZXdheUV2ZW50KTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+IHtcclxuICAgICAgICB0aGlzLmxvZyhldmVudC5yZXF1ZXN0Q29udGV4dC5yZXF1ZXN0SWQsIHRoaXMub25NZXNzYWdlLm5hbWUsIGV2ZW50KTtcclxuICAgICAgICBjb25zdCB2YWxpZGF0ZVJlc3VsdCA9IHRoaXMudmFsaWRhdGVSZXF1ZXN0KGV2ZW50KTtcclxuICAgICAgICBpZiAodmFsaWRhdGVSZXN1bHQuc3RhdHVzQ29kZSAhPT0gMjAwKSByZXR1cm4gdmFsaWRhdGVSZXN1bHQ7XHJcbiAgICAgICAgbGV0IGNvbm5lY3Rpb25EYXRhO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbm5lY3Rpb25EYXRhID0gYXdhaXQgdGhpcy5kYi5zY2FuKHsgVGFibGVOYW1lOiB0aGlzLnRhYmxlTmFtZSwgUHJvamVjdGlvbkV4cHJlc3Npb246ICdjb25uZWN0aW9uSWQnIH0pLnByb21pc2UoKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN0YXR1c0NvZGU6IDUwMCwgYm9keTogZS5zdGFjayB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgYXBpZ3dNYW5hZ2VtZW50QXBpID0gbmV3IEFXUy5BcGlHYXRld2F5TWFuYWdlbWVudEFwaSh7XHJcbiAgICAgICAgICAgIGFwaVZlcnNpb246ICcyMDE4LTExLTI5JyxcclxuICAgICAgICAgICAgZW5kcG9pbnQ6IGV2ZW50LnJlcXVlc3RDb250ZXh0LmRvbWFpbk5hbWUgKyAnLycgKyBldmVudC5yZXF1ZXN0Q29udGV4dC5zdGFnZVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoZXZlbnQuYm9keSkge1xyXG4gICAgICAgICAgICBjb25zdCBwb3N0RGF0YSA9IEpTT04ucGFyc2UoZXZlbnQuYm9keSkuZGF0YTtcclxuICAgICAgICAgICAgY29uc3QgcG9zdENhbGxzID0gY29ubmVjdGlvbkRhdGE/Lkl0ZW1zPy5tYXAoYXN5bmMgKHsgY29ubmVjdGlvbklkIH0pID0+IHtcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgYXBpZ3dNYW5hZ2VtZW50QXBpLnBvc3RUb0Nvbm5lY3Rpb24oeyBDb25uZWN0aW9uSWQ6IGNvbm5lY3Rpb25JZCwgRGF0YTogcG9zdERhdGEgfSkucHJvbWlzZSgpO1xyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChlLnN0YXR1c0NvZGUgPT09IDQxMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRm91bmQgc3RhbGUgY29ubmVjdGlvbiwgZGVsZXRpbmcgJHtjb25uZWN0aW9uSWR9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZGIuZGVsZXRlKHsgVGFibGVOYW1lOiB0aGlzLnRhYmxlTmFtZSwgS2V5OiB7IGNvbm5lY3Rpb25JZCB9IH0pLnByb21pc2UoKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHBvc3RDYWxscykge1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHBvc3RDYWxscyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN0YXR1c0NvZGU6IDUwMCwgYm9keTogZS5zdGFjayB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN0YXR1c0NvZGU6IDIwMCwgYm9keTogJ0RhdGEgc2VudC4nIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdGF0dXNDb2RlOiA1MDAsIGJvZHk6IFwiRW1wdHkgbWVzc2FnZVwiIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGF1dGhvcml6ZXIoZXZlbnQ6IEFQSUdhdGV3YXlSZXF1ZXN0QXV0aG9yaXplckV2ZW50KTogUHJvbWlzZTxBUElHYXRld2F5QXV0aG9yaXplclJlc3VsdD4ge1xyXG5cclxuICAgICAgICAvL2h0dHBzOi8vY29nbml0by1pZHAue3JlZ2lvbn0uYW1hem9uYXdzLmNvbS97dXNlclBvb2xJZH0vLndlbGwta25vd24vandrcy5qc29uXHJcbiAgICAgICAgdGhpcy5sb2coZXZlbnQucmVxdWVzdENvbnRleHQ/LnJlcXVlc3RJZCwgdGhpcy5hdXRob3JpemVyLm5hbWUsIGV2ZW50KTtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKG9rLCBmYWlsKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCB0b2tlbiA9IGV2ZW50Py5xdWVyeVN0cmluZ1BhcmFtZXRlcnM/LnRva2VuO1xyXG4gICAgICAgICAgICBpZiAodG9rZW4pIHtcclxuICAgICAgICAgICAgICAgIGxldCBqd2sgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhgL2Fzc2V0cy8ke3Byb2Nlc3MuZW52LkVOVklST05NRU5UfS5qd2tgLnRvTG93ZXJDYXNlKCkpLnRvU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcGVtID0gandrVG9QZW0oandrKTtcclxuICAgICAgICAgICAgICAgIGp3dC52ZXJpZnkodG9rZW4sIHBlbSwgKGVycjogYW55LCBkZWNvZGVkOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubG9nKGV2ZW50LnJlcXVlc3RDb250ZXh0Py5yZXF1ZXN0SWQsIHRoaXMuYXV0aG9yaXplci5uYW1lLCBldmVudCwgZXJyLCBcInZlcmlmeVwiLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9rKHRoaXMuZ2VuZXJhdGVQb2xpY3koXCJVc2VyXCIsIFwiRGVueVwiLCBldmVudC5tZXRob2RBcm4pKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9rKHRoaXMuZ2VuZXJhdGVQb2xpY3koXCJVc2VyXCIsIFwiQWxsb3dcIiwgZXZlbnQubWV0aG9kQXJuKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgb2sodGhpcy5nZW5lcmF0ZVBvbGljeShcIlVzZXJcIiwgXCJEZW55XCIsIGV2ZW50Lm1ldGhvZEFybikpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmNvbnN0IHdlYnNvY2tldCA9IG5ldyBXZWJTb2NrZXRTZXJ2ZXIoKTtcclxubW9kdWxlLmV4cG9ydHMub25Db25uZWN0ID0gd2Vic29ja2V0Lm9uQ29ubmVjdC5iaW5kKHdlYnNvY2tldCk7XHJcbm1vZHVsZS5leHBvcnRzLm9uRGlzY29ubmVjdCA9IHdlYnNvY2tldC5vbkRpc2Nvbm5lY3QuYmluZCh3ZWJzb2NrZXQpO1xyXG5tb2R1bGUuZXhwb3J0cy5vbk1lc3NhZ2UgPSB3ZWJzb2NrZXQub25NZXNzYWdlLmJpbmQod2Vic29ja2V0KTtcclxubW9kdWxlLmV4cG9ydHMuYXV0aG9yaXplciA9IHdlYnNvY2tldC5hdXRob3JpemVyLmJpbmQod2Vic29ja2V0KTsiXX0=