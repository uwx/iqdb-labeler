import { AppBskyLabelerService } from '@atcute/bluesky';
import { ComAtprotoLabelDefs, ComAtprotoRepoCreateRecord } from '@atcute/atproto';
import { loginAgent, LoginCredentials } from './index.js';
import { KittyAgent } from 'kitty-agent';
import { XRPCError } from '@atcute/xrpc-server';
import { ActorIdentifier } from '@atcute/lexicons';

/**
 * Declare the labels this labeler will apply. Necessary for users to be able to configure what they see.
 * @param credentials The credentials of the labeler account.
 * @param labelDefinitions The label definitions to declare. You can learn about the definition format [here](https://docs.bsky.app/docs/advanced-guides/moderation#custom-label-values).
 * @param overwriteExisting Whether to overwrite the existing label definitions if they already exist.
 */
export async function declareLabeler(
    credentials: LoginCredentials,
    labelDefinitions: Array<ComAtprotoLabelDefs.LabelValueDefinition>,
    overwriteExisting?: boolean,
): Promise<void> {
    const { agent, session } = await loginAgent(credentials);
    const labelValues = labelDefinitions.map(({ identifier }) => identifier);

    const existing = await getLabelerLabelDefinitions(credentials);
    if (existing?.length && !overwriteExisting) {
        if (overwriteExisting === false) return;
        else if (overwriteExisting === undefined) {
            throw new Error(
                'Label definitions already exist. Use `overwriteExisting: true` to update them, or `overwriteExisting: false` to silence this error.',
            );
        }
    }

    const input = {
        collection: 'app.bsky.labeler.service',
        rkey: 'self',
        repo: session.did,
        record: {
            $type: 'app.bsky.labeler.service',
            policies: { labelValues, labelValueDefinitions: labelDefinitions },
            createdAt: new Date().toISOString(),
        } satisfies AppBskyLabelerService.Main,
        validate: true,
    } satisfies ComAtprotoRepoCreateRecord.$input;

    // We check if existing is truthy because an empty array means the record exists, but contains no definitions.
    let result;
    if (existing) {
        result = await agent.post('com.atproto.repo.putRecord', { input });
    } else {
        result = await agent.post('com.atproto.repo.createRecord', { input });
    }

    if (!result.ok) {
        throw new XRPCError({
            status: 401,
            ...result.data,
        });
    }
}

/**
 * Get the label definitions currently declared by the labeler.
 * @param credentials The credentials of the labeler account.
 * @returns The label definitions.
 */
export async function getLabelerLabelDefinitions({
    identifier,
    pds,
}: {
    identifier: string;
    pds?: string;
}): Promise<Array<ComAtprotoLabelDefs.LabelValueDefinition> | null> {
    const agent = KittyAgent.createUnauthed(pds);
    const result = await agent.tryGetRecord({
        collection: 'app.bsky.labeler.service',
        rkey: 'self',
        repo: identifier as ActorIdentifier,
    });

    if (!result.value) {
        return null;
    }

    return result.value?.policies?.labelValueDefinitions ?? null;
}

/**
 * Set the label definitions for this labeler account.
 * @param credentials The credentials of the labeler account.
 * @param labelDefinitions The label definitions to set.
 */
export async function setLabelerLabelDefinitions(
    credentials: LoginCredentials,
    labelDefinitions: Array<ComAtprotoLabelDefs.LabelValueDefinition>,
) {
    return declareLabeler(credentials, labelDefinitions, true);
}

/**
 * Delete the labeler declaration for this account, removing all label definitions.
 * @param credentials The credentials of the labeler account.
 */
export async function deleteLabelerDeclaration(credentials: LoginCredentials): Promise<void> {
    const { agent, session } = await loginAgent(credentials);
    await agent.delete({
        collection: 'app.bsky.labeler.service',
        rkey: 'self',
        repo: session.did,
    });
}
