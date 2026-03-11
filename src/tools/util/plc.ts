import type { ComAtprotoIdentitySignPlcOperation } from '@atcute/atproto';
import { getPublicKey, utils } from '@noble/secp256k1';
import { toString as ui8ToString } from 'uint8arrays/to-string';
import { formatDidKey, parsePrivateKey, SECP256K1_JWT_ALG } from '../util/crypto.js';
import { loginAgent, LoginCredentials } from './index.js';

/** Options for the {@link plcSetupLabeler} function. */
export interface PlcSetupLabelerOptions extends LoginCredentials {
    /** The HTTPS URL where the labeler is hosted. */
    endpoint: string;

    /**
     * The token to use to sign the PLC operation.
     * If you don't have a token, first call {@link plcRequestToken} to receive one via email.
     */
    plcToken: string;

    /**
     * You may choose to provide your own secp256k1 signing key to use for the labeler.
     * Leave this empty to generate a new keypair.
     */
    privateKey?: string | Uint8Array;
    /** Whether to overwrite the existing label signing key if one is already set. */
    overwriteExistingKey?: boolean;
}

/** Options for the {@link plcClearLabeler} function. */
export interface PlcClearLabelerOptions extends LoginCredentials {
    /**
     * The token to use to sign the PLC operation.
     * If you don't have a token, first call {@link plcRequestToken} to receive one via email.
     */
    plcToken: string;
}

/**
 * This function will update the labeler account's DID document to include the
 * provided labeler endpoint and signing key. If no private key is provided, a
 * new keypair will be generated, and the private key will be printed to the
 * console. This private key will be needed to sign any labels created.
 * To set up a labeler, call this function followed by {@link declareLabeler}.
 * @param options Options for the function.
 * @returns The PLC operation that was submitted.
 */
export async function plcSetupLabeler(options: PlcSetupLabelerOptions) {
    const { agent } = await loginAgent({
        pds: options.pds,
        identifier: options.identifier,
        password: options.password,
    });

    const privateKey = options.privateKey
        ? options.privateKey instanceof Uint8Array
            ? options.privateKey
            : parsePrivateKey(options.privateKey)
        : utils.randomSecretKey();

    const publicKey = getPublicKey(privateKey);
    const keyDid = formatDidKey(SECP256K1_JWT_ALG, publicKey);

    const operation: ComAtprotoIdentitySignPlcOperation.Input = {};

    const result = await agent.get('com.atproto.identity.getRecommendedDidCredentials', {});
    if (!result.ok) {
        throw new Error(`Failed to get recommended DID credentials: ${result.data.error}`);
    }
    const credentials = result.data;

    if (
        !credentials.verificationMethods ||
        !(typeof credentials.verificationMethods === 'object') ||
        !('atproto_label' in credentials.verificationMethods) ||
        !credentials.verificationMethods['atproto_label'] ||
        (credentials.verificationMethods['atproto_label'] !== keyDid && options.overwriteExistingKey)
    ) {
        operation.verificationMethods = {
            ...(credentials.verificationMethods || {}),
            atproto_label: keyDid,
        };
    }

    if (
        !credentials.services ||
        !(typeof credentials.services === 'object') ||
        !('atproto_labeler' in credentials.services) ||
        !credentials.services['atproto_labeler'] ||
        typeof credentials.services['atproto_labeler'] !== 'object' ||
        !('endpoint' in credentials.services['atproto_labeler']) ||
        credentials.services['atproto_labeler'].endpoint !== options.endpoint
    ) {
        operation.services = {
            ...(credentials.services || {}),
            atproto_labeler: { type: 'AtprotoLabeler', endpoint: options.endpoint },
        };
    }

    if (Object.keys(operation).length === 0) {
        return;
    }

    const plcOpResult = await agent.post('com.atproto.identity.signPlcOperation', {
        input: { token: options.plcToken, ...operation },
    });

    if (!plcOpResult.ok) {
        throw new Error(`Failed to sign PLC operation: ${plcOpResult.data.error}`);
    }
    const plcOp = plcOpResult.data;

    const submitPlcOpResult = await agent.post('com.atproto.identity.submitPlcOperation', {
        as: 'json',
        input: { operation: plcOp.operation },
    });

    if (!submitPlcOpResult.ok) {
        throw new Error(`Failed to submit PLC operation: ${submitPlcOpResult.data.error}`);
    }

    if (!options.privateKey && operation.verificationMethods) {
        const privateKeyString = ui8ToString(privateKey, 'hex');
        console.log(
            "This is your labeler's signing key. It will be needed to sign any labels you create.",
            'You will not be able to retrieve this key again, so make sure to save it somewhere safe.',
            'If you lose this key, you can run this again to generate a new one.',
        );
        console.log('Signing key:', privateKeyString);
    }

    return operation;
}

/**
 * This function will remove the labeler endpoint and signing key from the labeler account's DID document.
 * To restore a labeler to a regular account, call this function followed by {@link deleteLabelerDeclaration}.
 * @param options Options for the function.
 */
export async function plcClearLabeler(options: PlcClearLabelerOptions) {
    const { agent } = await loginAgent({
        pds: options.pds,
        identifier: options.identifier,
        password: options.password,
    });

    const result = await agent.get('com.atproto.identity.getRecommendedDidCredentials', {});

    if (!result.ok) {
        throw new Error(`Failed to get recommended DID credentials: ${result.data.error}`);
    }
    const credentials = result.data;

    if (
        credentials.verificationMethods &&
        typeof credentials.verificationMethods === 'object' &&
        'atproto_label' in credentials.verificationMethods
    ) {
        delete credentials.verificationMethods.atproto_label;
    }

    if (
        credentials.services &&
        typeof credentials.services === 'object' &&
        'atproto_labeler' in credentials.services &&
        credentials.services['atproto_labeler']
    ) {
        delete credentials.services.atproto_labeler;
    }

    const plcOpResult = await agent.post('com.atproto.identity.signPlcOperation', {
        input: { token: options.plcToken, ...credentials },
    });

    if (!plcOpResult.ok) {
        throw new Error(`Failed to sign PLC operation: ${plcOpResult.data.error}`);
    }
    const plcOp = plcOpResult.data;

    const submitPlcOpResult = await agent.post('com.atproto.identity.submitPlcOperation', {
        as: 'json',
        input: { operation: plcOp.operation },
    });

    if (!submitPlcOpResult.ok) {
        throw new Error(`Failed to submit PLC operation: ${submitPlcOpResult.data.error}`);
    }
}

/**
 * Request a PLC token, needed for {@link plcSetupLabeler}. The token will be sent to the email
 * associated with the labeler account.
 * @param credentials The credentials of the labeler account.
 */
export async function plcRequestToken(credentials: LoginCredentials): Promise<void> {
    const { agent } = await loginAgent(credentials);
    const plcOpResult = await agent.post('com.atproto.identity.requestPlcOperationSignature', {
        as: 'json',
    });

    if (!plcOpResult.ok) {
        throw new Error(`Failed to request PLC operation signature: ${plcOpResult.data.error}`);
    }
}
