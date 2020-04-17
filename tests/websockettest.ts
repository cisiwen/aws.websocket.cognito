import { expect } from 'chai';
import { describe, it } from 'mocha';
import { WebSocketServerInstance } from "../src/websocket";
process.env.ENVIRONMENT = "Development";
describe("WebsocketServerTest", () => {
    describe("Authorizer", () => {
        it("good input", async (done) => {
            let token: string = "eyJraWQiOiJ5a2ZiVFl1WHFTWDFHOG96UE5FeHVQNzBYN2YrZ2pkS1ZNNHQ5dFMxbk1zPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiVWpIMWRFcy1iN2xrXzkxa3NVT1VNZyIsInN1YiI6ImY0NWY1Mjc3LWNkYzQtNDk4Zi04NDViLWY3N2Q0OTc5NTBiYSIsImNvZ25pdG86Z3JvdXBzIjpbImFwLXNvdXRoZWFzdC0yX3Uxa3QyVVlYQV9zd21hZCIsIkNsb3VkVmlkZW8tQWRtaW4iXSwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJjb2duaXRvOnByZWZlcnJlZF9yb2xlIjoiYXJuOmF3czppYW06OjgyMjYxODg0ODY2NTpyb2xlXC9DbG91ZFZpZGVvLUFkbWluIiwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmFwLXNvdXRoZWFzdC0yLmFtYXpvbmF3cy5jb21cL2FwLXNvdXRoZWFzdC0yX3Uxa3QyVVlYQSIsImNvZ25pdG86dXNlcm5hbWUiOiJzd21hZF9XV2VuZ0BzZXZlbi5jb20uYXUiLCJub25jZSI6Ik9nS0hUSWNoSXV2M1pZTWl5bnJhTUdHamhjSG1rWllJbXdxOGthX0pucTFTMFBuV3lPcmpWMGFOZlN0eFhJdDJyZ21NQS1aOFdPcUpaNE9pQkM1Y1p6YXRfdFdTaVVULXZWY3dFelp0aUFhMDJhdGlpN1ZxYVZsRkxtcDNBYktKdHBQNTE5MGwzb2VhOVpnR3ZybXZ4ZEppWDh6RFgxblc4bTlDLWdBRmlnVSIsImNvZ25pdG86cm9sZXMiOlsiYXJuOmF3czppYW06OjgyMjYxODg0ODY2NTpyb2xlXC9DbG91ZFZpZGVvLUFkbWluIl0sImF1ZCI6IjFudGJyNjNjYzR0MDFxYWt1cnIzZG9sMGRoIiwiaWRlbnRpdGllcyI6W3sidXNlcklkIjoiV1dlbmdAc2V2ZW4uY29tLmF1IiwicHJvdmlkZXJOYW1lIjoic3dtYWQiLCJwcm92aWRlclR5cGUiOiJTQU1MIiwiaXNzdWVyIjoiaHR0cHM6XC9cL3N0cy53aW5kb3dzLm5ldFwvOTkyZGI1OGUtNzk0NC00MjJmLTg1YjMtNDczM2MxZDc1N2I4XC8iLCJwcmltYXJ5IjoidHJ1ZSIsImRhdGVDcmVhdGVkIjoiMTU3OTQ5NjA4MzM0NSJ9XSwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE1ODcxMjE5MDcsImV4cCI6MTU4NzEyNTUwNywiaWF0IjoxNTg3MTIxOTA3LCJlbWFpbCI6IldXZW5nQHNldmVuLmNvbS5hdSJ9.Nxbm7myqSbm8927eKx3yFbPcHcaXddr7v1OdKc2FykJBaREZd2s7BYxwFMwSK3vb7pVR6c0mpAwvVinEV--iRmyht290Llzedzhdzt2Jg0oPPnG9VMe6KK2sRCGtE0jEYXB0SLcV5wTrkDCZlVNz17u_20VoS4liq4e03z9RoiQVbSYeMa2F1V3XZKk9MGn0K6xqsTheh3QTzfHKd-tIn_GCKlUhFVuNWpTmtfw0GyckhaqtLS6fZ1tlpFEfUayCZxWAR9O-g0AMi0fcXNYTodbhLmq337AhNjWbmT4ZwSMp2p_wSmGCQlCfO9U1YIryR6s8RYsJRKIhYFq3XBlQdA";
            try {
                await WebSocketServerInstance.authorizer(JSON.parse(JSON.stringify({
                    queryStringParameters: {
                        token: token
                    },
                    requestContext: JSON.parse(JSON.stringify({
                        requestId: "dddd"
                    }))
                })));
                done()
            }
            catch (error) {
                done(error)
            }
        }).timeout(100000)
    })
})