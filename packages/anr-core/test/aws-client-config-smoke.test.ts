import { CognitoIdentityClient, GetIdCommand } from "@aws-sdk/client-cognito-identity"
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb"
import { describe, expect, test } from "bun:test"
import { HttpResponse } from "@smithy/protocol-http"
import { anrClientConfig } from "../src/util/aws-client-config"

const requestHandler: NonNullable<ConstructorParameters<typeof CognitoIdentityClient>[0]>["requestHandler"] = {
  handle: async (request) => {
    const target = request.headers["x-amz-target"]
    const body =
      target === "AWSCognitoIdentityService.GetId"
        ? { IdentityId: "us-east-2:00000000-0000-0000-0000-000000000000" }
        : { TableNames: [] }

    return {
      response: new HttpResponse({
        statusCode: 200,
        headers: {
          "content-type": "application/x-amz-json-1.1",
        },
        body: new TextEncoder().encode(JSON.stringify(body)),
      }),
    }
  },
  updateHttpClientConfig: () => {},
  httpHandlerConfigs: () => ({}),
}

describe("AWS Bun workaround smoke", () => {
  test("constructs Cognito and DynamoDB clients and can send commands", async () => {
    const credentials = {
      accessKeyId: "test",
      secretAccessKey: "test",
      sessionToken: "test",
    }
    const cognitoClient = new CognitoIdentityClient({
      ...anrClientConfig({ region: "us-east-2" }),
      credentials,
      requestHandler,
    })
    const dynamoClient = new DynamoDBClient({
      ...anrClientConfig({ region: "us-east-2" }),
      credentials,
      requestHandler,
    })

    const identity = await cognitoClient.send(
      new GetIdCommand({
        IdentityPoolId: "us-east-2:00000000-0000-0000-0000-000000000000",
      }),
    )
    const tables = await dynamoClient.send(new ListTablesCommand({ Limit: 1 }))

    expect(identity.IdentityId).toBe("us-east-2:00000000-0000-0000-0000-000000000000")
    expect(tables.TableNames).toEqual([])
  })
})
