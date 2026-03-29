import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

const ADMIN_GROUP_NAME = 'administrators';

export class BonaeStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { mutable: true },
        familyName: { mutable: true },
        phoneNumber: { mutable: true },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cognito.UserPoolGroup(this, 'AdminGroup', {
      userPool: this.userPool,
      groupName: ADMIN_GROUP_NAME,
      description: 'Site administrators — content publish and overrides',
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
    });

    const profilesTable = new dynamodb.Table(this, 'ProfilesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const contentTable = new dynamodb.Table(this, 'SiteContentTable', {
      partitionKey: { name: 'locale', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const githubSecret = new secretsmanager.Secret(this, 'GitHubDispatchSecret', {
      description: 'JSON: {"githubToken":"ghp_...","repository":"owner/repo"} for repository_dispatch',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({ githubToken: '', repository: '' }),
      ),
    });

    const apiFn = new lambda.NodejsFunction(this, 'ApiHandler', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/api/handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
      environment: {
        PROFILES_TABLE: profilesTable.tableName,
        CONTENT_TABLE: contentTable.tableName,
        ADMIN_GROUP: ADMIN_GROUP_NAME,
        GITHUB_SECRET_ARN: githubSecret.secretArn,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
      },
    });

    profilesTable.grantReadWriteData(apiFn);
    contentTable.grantReadWriteData(apiFn);
    githubSecret.grantRead(apiFn);

    const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`;

    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer('JwtAuthorizer', issuer, {
      jwtAudience: [this.userPoolClient.userPoolClientId],
      identitySource: ['$request.header.Authorization'],
    });

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'bonae-api',
      corsPreflight: {
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    const integration = new integrations.HttpLambdaIntegration('ApiIntegration', apiFn);

    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });

    this.httpApi.addRoutes({
      path: '/me/profile',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      integration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/content/{locale}',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      integration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/publish',
      methods: [apigwv2.HttpMethod.POST],
      integration,
      authorizer: jwtAuthorizer,
    });

    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'CognitoIssuer', { value: issuer });
    new cdk.CfnOutput(this, 'ApiUrl', { value: this.httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'ProfilesTableName', { value: profilesTable.tableName });
    new cdk.CfnOutput(this, 'ContentTableName', { value: contentTable.tableName });
    new cdk.CfnOutput(this, 'GitHubSecretArn', { value: githubSecret.secretArn });
    new cdk.CfnOutput(this, 'AdminGroupName', { value: ADMIN_GROUP_NAME });
  }
}
