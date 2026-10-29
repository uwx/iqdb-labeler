import { ComAtprotoLabelDefs } from '@atcute/client/lexicons';

export interface Label {
    identifier: string;
    locales: ComAtprotoLabelDefs.LabelValueDefinitionStrings[];
}
