import * as cdk from "@aws-cdk/core";
import dynamodb = require('@aws-cdk/aws-dynamodb');
import apigatewayv2 = require('@aws-cdk/aws-apigatewayv2');
import { Function, Runtime, AssetCode } from "@aws-cdk/aws-lambda";
import { CfnApiProps, CfnRoute, CfnRouteProps, CfnIntegration, CfnIntegrationProps, CfnApi, CfnAuthorizer } from "@aws-cdk/aws-apigatewayv2";
import { ServicePrincipal, Effect, PolicyStatement, IRole } from "@aws-cdk/aws-iam";
import { CfnOutput } from "@aws-cdk/core";
export interface IStackBase {
    projectName: string;
    environment: string;
    environmentShort: string;
}
export interface IWebsocketStackSetting extends IStackBase {
    codeSource: string;
}
export class WebSocketStack extends cdk.Stack {
    private setting: IWebsocketStackSetting;
    private table: dynamodb.Table;
    constructor(scope: cdk.App, id: string, setting: IWebsocketStackSetting, props?: cdk.StackProps) {
        super(scope, id, props);
        this.setting = setting;
        this.table = this.addDynamoDB();
        this.createApiGateway();

    }



    createLambda(api: CfnApi, name: string, handler: string, source: string): Function {
        let lambda = new Function(this, name, {
            runtime: Runtime.NODEJS_12_X,
            functionName: `${this.setting.environmentShort}-${this.setting.projectName}-${name}`.toLowerCase(),
            handler: handler,
            code: AssetCode.fromAsset(source),
            environment: {
                TABLE_NAME: this.table.tableName,
                ENVIRONMENT: this.setting.environment
            },
            logRetention: 7
        });
        lambda.grantInvoke(new ServicePrincipal("apigateway.amazonaws.com"));
        if (lambda.role) {
            let role: IRole = lambda.role;
            this.table.grantReadWriteData(role);
        }

        lambda.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["execute-api:ManageConnections"],
            resources: [`arn:aws:execute-api:${this.region}:${this.account}:${api.ref}/*`]
        }))
        return lambda;
    }

    addRoute(api: CfnApi, routeKey: string, operationName: string, func: Function, authorizer?: CfnAuthorizer): CfnRoute {
        let cfnIntegrationProps: CfnIntegrationProps = {
            apiId: api.ref,
            description: operationName,
            integrationType: "AWS_PROXY",
            integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${func.functionArn}/invocations`
        }
        let integration: CfnIntegration = new CfnIntegration(this, `${operationName}Integration`, cfnIntegrationProps)

        let routeProps: CfnRouteProps = {
            apiId: api.ref,
            routeKey: routeKey,
            authorizationType: authorizer ? "CUSTOM" : "NONE",
            authorizerId: authorizer ? authorizer.ref : undefined,
            operationName: operationName,
            target: `integrations/${integration.ref}`
        };
        let route: CfnRoute = new CfnRoute(this, `${operationName}Route`, routeProps);
        route.addDependsOn(integration);
        return route;
    }

    addDynamoDB(): dynamodb.Table {
        const tableProps: dynamodb.TableProps = {
            partitionKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
            readCapacity: 5,
            writeCapacity: 5,
            serverSideEncryption: true,
            tableName: `${this.setting.environmentShort}-${this.setting.projectName}`.toLowerCase()
        };
        const table = new dynamodb.Table(this, 'ConnectionsTable', tableProps);
        new CfnOutput(this, "ConnectionsTableArn", { description: "Connections table ARN", value: table.tableArn });
        return table;
    }
    public createAuthorizer(api: CfnApi, func: Function): CfnAuthorizer {
        const cfnAuthorizer = new CfnAuthorizer(this, "ApiGatewayCognitoAuthorizer", {
            apiId: api.ref,
            name: "CustomCognitoAuthorizer",
            authorizerType: "REQUEST",
            identitySource: ["route.request.querystring.token"],
            authorizerUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${func.functionArn}/invocations`
        });
        return cfnAuthorizer;
    }
    createApiGateway() {
        let v2Props: CfnApiProps = {
            name: `${this.setting.environmentShort}-${this.setting.projectName}`.toLowerCase(),
            protocolType: "WEBSOCKET",
            routeSelectionExpression: "$request.body.message",
        };
        let api = new apigatewayv2.CfnApi(this, "ApigatewayWebsocket", v2Props)

        let staging = new apigatewayv2.CfnStage(this, "ApigatewayWebsocketStage", {
            apiId: api.ref,
            description: `${this.setting.environment} Stage`,
            stageName: this.setting.environmentShort,
            autoDeploy: true
        })
        let authorizerFunc = this.createLambda(api, "authorizer", "websocket.authorizer", this.setting.codeSource);
        let authorizer = this.createAuthorizer(api, authorizerFunc);

        let onConnectionFunc = this.createLambda(api, "OnConnect", "websocket.onConnect", this.setting.codeSource);
        let onConnectionRoute = this.addRoute(api, "$connect", "ConnectRoute", onConnectionFunc, authorizer);

        let disConnectionFunc = this.createLambda(api, "OnDisconnect", "websocket.onDisconnect", this.setting.codeSource);
        let disConnectionRoute = this.addRoute(api, "$disconnect", "DisconnectRoute", disConnectionFunc);

        let seneMessageFunc = this.createLambda(api, "OnMessage", "websocket.onMessage", this.setting.codeSource);
        let sendMessageRoute = this.addRoute(api, "sendmessage", "OnMessageRoute", seneMessageFunc);

        new CfnOutput(this, "WebSocketURI", { value: `wss://${api.ref}.execute-api.${this.region}.amazonaws.com/` })
    }
}