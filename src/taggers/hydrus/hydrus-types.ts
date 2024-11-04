/* eslint-disable @typescript-eslint/no-explicit-any */

const META_SERIALISABLE_TYPE_JSON_OK = 0;
const META_SERIALISABLE_TYPE_JSON_BYTES = 1;
const META_SERIALISABLE_TYPE_HYDRUS_SERIALISABLE = 2;

export const enum HydrusSerialisable {
    SERIALISABLE_TYPE_BASE = 0,
    SERIALISABLE_TYPE_BASE_NAMED = 1,
    SERIALISABLE_TYPE_SHORTCUT_SET = 2,
    SERIALISABLE_TYPE_SUBSCRIPTION_LEGACY = 3,
    SERIALISABLE_TYPE_PERIODIC = 4,
    SERIALISABLE_TYPE_GALLERY_IDENTIFIER = 5,
    SERIALISABLE_TYPE_TAG_IMPORT_OPTIONS = 6,
    SERIALISABLE_TYPE_FILE_IMPORT_OPTIONS = 7,
    SERIALISABLE_TYPE_FILE_SEED_CACHE = 8,
    SERIALISABLE_TYPE_HDD_IMPORT = 9,
    SERIALISABLE_TYPE_SERVER_TO_CLIENT_CONTENT_UPDATE_PACKAGE = 10,
    SERIALISABLE_TYPE_SERVER_TO_CLIENT_SERVICE_UPDATE_PACKAGE = 11,
    SERIALISABLE_TYPE_MANAGEMENT_CONTROLLER = 12,
    SERIALISABLE_TYPE_GUI_SESSION_LEGACY = 13,
    SERIALISABLE_TYPE_PREDICATE = 14,
    SERIALISABLE_TYPE_FILE_SEARCH_CONTEXT = 15,
    SERIALISABLE_TYPE_EXPORT_FOLDER = 16,
    SERIALISABLE_TYPE_WATCHER_IMPORT = 17,
    SERIALISABLE_TYPE_SIMPLE_DOWNLOADER_IMPORT = 18,
    SERIALISABLE_TYPE_IMPORT_FOLDER = 19,
    SERIALISABLE_TYPE_MULTIPLE_GALLERY_IMPORT = 20,
    SERIALISABLE_TYPE_DICTIONARY = 21,
    SERIALISABLE_TYPE_CLIENT_OPTIONS = 22,
    SERIALISABLE_TYPE_CONTENT = 23,
    SERIALISABLE_TYPE_PETITION = 24,
    SERIALISABLE_TYPE_ACCOUNT_IDENTIFIER = 25,
    SERIALISABLE_TYPE_LIST = 26,
    SERIALISABLE_TYPE_PARSE_FORMULA_HTML = 27,
    SERIALISABLE_TYPE_URLS_IMPORT = 28,
    SERIALISABLE_TYPE_PARSE_NODE_CONTENT_LINK = 29,
    SERIALISABLE_TYPE_CONTENT_PARSER = 30,
    SERIALISABLE_TYPE_PARSE_FORMULA_JSON = 31,
    SERIALISABLE_TYPE_PARSE_ROOT_FILE_LOOKUP = 32,
    SERIALISABLE_TYPE_BYTES_DICT = 33,
    SERIALISABLE_TYPE_CONTENT_UPDATE = 34,
    SERIALISABLE_TYPE_CREDENTIALS = 35,
    SERIALISABLE_TYPE_DEFINITIONS_UPDATE = 36,
    SERIALISABLE_TYPE_METADATA = 37,
    SERIALISABLE_TYPE_BANDWIDTH_RULES = 38,
    SERIALISABLE_TYPE_BANDWIDTH_TRACKER = 39,
    SERIALISABLE_TYPE_CLIENT_TO_SERVER_UPDATE = 40,
    SERIALISABLE_TYPE_SHORTCUT = 41,
    SERIALISABLE_TYPE_APPLICATION_COMMAND = 42,
    SERIALISABLE_TYPE_DUPLICATE_CONTENT_MERGE_OPTIONS = 43,
    SERIALISABLE_TYPE_TAG_FILTER = 44,
    SERIALISABLE_TYPE_NETWORK_BANDWIDTH_MANAGER_LEGACY = 45,
    SERIALISABLE_TYPE_NETWORK_SESSION_MANAGER_LEGACY = 46,
    SERIALISABLE_TYPE_NETWORK_CONTEXT = 47,
    SERIALISABLE_TYPE_NETWORK_LOGIN_MANAGER = 48,
    SERIALISABLE_TYPE_MEDIA_SORT = 49,
    SERIALISABLE_TYPE_URL_CLASS = 50,
    SERIALISABLE_TYPE_STRING_MATCH = 51,
    SERIALISABLE_TYPE_CHECKER_OPTIONS = 52,
    SERIALISABLE_TYPE_NETWORK_DOMAIN_MANAGER = 53,
    SERIALISABLE_TYPE_SUBSCRIPTION_QUERY_LEGACY = 54,
    SERIALISABLE_TYPE_STRING_CONVERTER = 55,
    SERIALISABLE_TYPE_FILENAME_TAGGING_OPTIONS = 56,
    SERIALISABLE_TYPE_FILE_SEED = 57,
    SERIALISABLE_TYPE_PAGE_PARSER = 58,
    SERIALISABLE_TYPE_PARSE_FORMULA_ZIPPER = 59,
    SERIALISABLE_TYPE_PARSE_FORMULA_CONTEXT_VARIABLE = 60,
    SERIALISABLE_TYPE_TAG_SUMMARY_GENERATOR = 61,
    SERIALISABLE_TYPE_PARSE_RULE_HTML = 62,
    SERIALISABLE_TYPE_SIMPLE_DOWNLOADER_PARSE_FORMULA = 63,
    SERIALISABLE_TYPE_MULTIPLE_WATCHER_IMPORT = 64,
    SERIALISABLE_TYPE_SERVICE_TAG_IMPORT_OPTIONS = 65,
    SERIALISABLE_TYPE_GALLERY_SEED = 66,
    SERIALISABLE_TYPE_GALLERY_SEED_LOG = 67,
    SERIALISABLE_TYPE_GALLERY_IMPORT = 68,
    SERIALISABLE_TYPE_GALLERY_URL_GENERATOR = 69,
    SERIALISABLE_TYPE_NESTED_GALLERY_URL_GENERATOR = 70,
    SERIALISABLE_TYPE_DOMAIN_METADATA_PACKAGE = 71,
    SERIALISABLE_TYPE_LOGIN_CREDENTIAL_DEFINITION = 72,
    SERIALISABLE_TYPE_LOGIN_SCRIPT_DOMAIN = 73,
    SERIALISABLE_TYPE_LOGIN_STEP = 74,
    SERIALISABLE_TYPE_CLIENT_API_MANAGER = 75,
    SERIALISABLE_TYPE_CLIENT_API_PERMISSIONS = 76,
    SERIALISABLE_TYPE_SERVICE_KEYS_TO_TAGS = 77,
    SERIALISABLE_TYPE_MEDIA_COLLECT = 78,
    SERIALISABLE_TYPE_TAG_DISPLAY_MANAGER = 79,
    SERIALISABLE_TYPE_tag_context = 80,
    SERIALISABLE_TYPE_FAVOURITE_SEARCH_MANAGER = 81,
    SERIALISABLE_TYPE_NOTE_IMPORT_OPTIONS = 82,
    SERIALISABLE_TYPE_STRING_SPLITTER = 83,
    SERIALISABLE_TYPE_STRING_PROCESSOR = 84,
    SERIALISABLE_TYPE_TAG_AUTOCOMPLETE_OPTIONS = 85,
    SERIALISABLE_TYPE_SUBSCRIPTION_QUERY_LOG_CONTAINER = 86,
    SERIALISABLE_TYPE_SUBSCRIPTION_QUERY_HEADER = 87,
    SERIALISABLE_TYPE_SUBSCRIPTION = 88,
    SERIALISABLE_TYPE_FILE_SEED_CACHE_STATUS = 89,
    SERIALISABLE_TYPE_SUBSCRIPTION_CONTAINER = 90,
    SERIALISABLE_TYPE_COLUMN_LIST_STATUS = 91,
    SERIALISABLE_TYPE_COLUMN_LIST_MANAGER = 92,
    SERIALISABLE_TYPE_NUMBER_TEST = 93,
    SERIALISABLE_TYPE_NETWORK_BANDWIDTH_MANAGER = 94,
    SERIALISABLE_TYPE_NETWORK_SESSION_MANAGER = 95,
    SERIALISABLE_TYPE_NETWORK_SESSION_MANAGER_SESSION_CONTAINER = 96,
    SERIALISABLE_TYPE_NETWORK_BANDWIDTH_MANAGER_TRACKER_CONTAINER = 97,
    SERIALISABLE_TYPE_SIDECAR_EXPORTER = 98,
    SERIALISABLE_TYPE_STRING_SORTER = 99,
    SERIALISABLE_TYPE_STRING_SLICER = 100,
    SERIALISABLE_TYPE_TAG_SORT = 101,
    SERIALISABLE_TYPE_ACCOUNT_TYPE = 102,
    SERIALISABLE_TYPE_LOCATION_CONTEXT = 103,
    SERIALISABLE_TYPE_GUI_SESSION_CONTAINER = 104,
    SERIALISABLE_TYPE_GUI_SESSION_PAGE_DATA = 105,
    SERIALISABLE_TYPE_GUI_SESSION_CONTAINER_PAGE_NOTEBOOK = 106,
    SERIALISABLE_TYPE_GUI_SESSION_CONTAINER_PAGE_SINGLE = 107,
    SERIALISABLE_TYPE_PRESENTATION_IMPORT_OPTIONS = 108,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_ROUTER = 109,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_IMPORTER_TXT = 110,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_IMPORTER_MEDIA_TAGS = 111,
    SERIALISABLE_TYPE_STRING_TAG_FILTER = 112,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_EXPORTER_JSON = 113,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_IMPORTER_JSON = 114,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_EXPORTER_MEDIA_TAGS = 115,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_EXPORTER_TXT = 116,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_EXPORTER_MEDIA_URLS = 117,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_IMPORTER_MEDIA_URLS = 118,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_EXPORTER_MEDIA_NOTES = 119,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_IMPORTER_MEDIA_NOTES = 120,
    SERIALISABLE_TYPE_TIMESTAMP_DATA = 121,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_EXPORTER_MEDIA_TIMESTAMPS = 122,
    SERIALISABLE_TYPE_METADATA_SINGLE_FILE_IMPORTER_MEDIA_TIMESTAMPS = 123,
    SERIALISABLE_TYPE_PETITION_HEADER = 124,
    SERIALISABLE_TYPE_STRING_JOINER = 125,
    SERIALISABLE_TYPE_FILE_FILTER = 126,
    SERIALISABLE_TYPE_URL_CLASS_PARAMETER_FIXED_NAME = 127,
    SERIALISABLE_TYPE_DUPLICATES_AUTO_RESOLUTION_RULE = 128,
    SERIALISABLE_TYPE_DUPLICATES_AUTO_RESOLUTION_PAIR_SELECTOR_AND_COMPARATOR = 129,
    SERIALISABLE_TYPE_DUPLICATES_AUTO_RESOLUTION_PAIR_COMPARATOR_ONE_FILE = 130,
    SERIALISABLE_TYPE_DUPLICATES_AUTO_RESOLUTION_PAIR_COMPARATOR_TWO_FILES_RELATIVE = 131,
    SERIALISABLE_TYPE_METADATA_CONDITIONAL = 132,
    SERIALISABLE_TYPE_PARSE_FORMULA_NESTED = 133,
}

type SerializableType<T> = { SERIALISABLE_NAME: string, SERIALISABLE_TYPE: HydrusSerialisable, SERIALISABLE_VERSION: number, deserialize(serializedInfo: any): T };

// @ts-expect-error stfu
const SerializableTypes: Record<HydrusSerialisable, SerializableType<HydrusSerializableBase>> = {};

function addSerializableType(t: SerializableType<HydrusSerializableBase>) {
    SerializableTypes[t.SERIALISABLE_TYPE] = t;
}

abstract class HydrusSerializableBase {
    static tryDeserialize<T>({SERIALISABLE_TYPE, SERIALISABLE_VERSION, deserialize}: SerializableType<T>, tuple: unknown[]) {
        return tuple[0] == SERIALISABLE_TYPE && tuple[1] == SERIALISABLE_VERSION ? deserialize(tuple[2]) : undefined;
    }
}
function InitialiseFromSerialisableInfo<T>(self: SerializableType<T>, original_version: any, serialisable_info: any, raise_error_on_future_version = false) {
    const object_is_newer = original_version > self.SERIALISABLE_VERSION

    if (object_is_newer) {

        if (raise_error_on_future_version) {
            let message = `Unfortunately, an object of type ${self.SERIALISABLE_NAME} could not be loaded because it was created in a client/server that uses an updated version of that object! We support up to version ${self.SERIALISABLE_VERSION}, but the object was version ${original_version}.`;
            message += '\n\n'
            message += 'Please update your client/server to import this object.'

            throw new Error(message);
        } else {
            const message = `An object of type ${self.SERIALISABLE_NAME} was created in a client/server that uses an updated version of that object! We support versions up to ${self.SERIALISABLE_VERSION}, but the object was version ${original_version}. For now, we will try to continue work, but things may break. If you know why this has occured, please correct it. If you do not, please let hydrus dev know.`;

            console.error(message);
        }

    try:

        current_version = original_version

        while current_version < self.SERIALISABLE_VERSION:

            ( current_version, serialisable_info ) = self._UpdateSerialisableInfo( current_version, serialisable_info )


    except:

        raise HydrusExceptions.SerialisationException( 'Could not update this object of type {} from version {} to {}!'.format( self.SERIALISABLE_NAME, original_version, self.SERIALISABLE_VERSION ) )


    try:

        return self.deserialize( serialisable_info )

    except:

        if object_is_newer:

            throw new Error( `An object of type ${self.SERIALISABLE_NAME} was created in a client/server that uses an updated version of that object! We support versions up to ${self.SERIALISABLE_VERSION}, but the object was version ${original_version }. I tried to load it, but the initialisation failed. You probably need to update your client/server.`

        else:

            raise HydrusExceptions.SerialisationException( 'Could not initialise this object of type {}!'.format( self.SERIALISABLE_NAME ) )
}


function createFromSerialisableTuple(obj_tuple: any[], raise_error_on_future_version = false): HydrusSerializableBase {
    let obj: any;

    if (obj_tuple.length == 3) {
        const [serialisable_type, version, serialisable_info] = obj_tuple;
        obj = SerializableTypes[serialisable_type]
    } else {
        const [serialisable_type, name, version, serialisable_info] = obj_tuple;

        obj = SerializableTypes[serialisable_type](name)
    }

    obj.InitialiseFromSerialisableInfo(version, serialisable_info, raise_error_on_future_version = raise_error_on_future_version)

    return obj
}

function convertMetaSerialisableTupleToObject(meta_tuple: any) {
    const [metatype, serialisable] = meta_tuple;

    let obj: any;
    if (metatype == META_SERIALISABLE_TYPE_HYDRUS_SERIALISABLE) {
        obj = CreateFromSerialisableTuple(serialisable)
    } else if (metatype == META_SERIALISABLE_TYPE_JSON_BYTES) {
        obj = bytes.fromhex(serialisable)
    } else {
        obj = serialisable
    }

    return obj
}

class Dictionary extends HydrusSerializableBase {
    static readonly SERIALISABLE_TYPE = HydrusSerialisable.SERIALISABLE_TYPE_DICTIONARY;
    static readonly SERIALISABLE_NAME = 'Serialisable Dictionary';
    static readonly SERIALISABLE_VERSION = 2 // this is used in the network, do not update it casually!;

    static deserialize(serializedInfo: any) {
        // https://github.com/hydrusnetwork/hydrus/blob/0473e6e7424303c086eb4b507f6c7bc7e0c1ba41/hydrus/core/HydrusSerialisable.py#L468

        for (const [meta_key, meta_value] of serializedInfo) {

        }
    }
}
addSerializableType(Dictionary);

class Metadata extends HydrusSerializableBase {
    static readonly SERIALISABLE_TYPE = HydrusSerialisable.SERIALISABLE_TYPE_METADATA;
    static readonly SERIALISABLE_NAME = 'Metadata';
    static readonly SERIALISABLE_VERSION = 1;

    metadata: [update_index: number, update_hashes: string[], begin: number, end: number][] = [];
    next_update_due: number = 0;

    static deserialize(serializedInfo: any) {
        // https://github.com/hydrusnetwork/hydrus/blob/0473e6e7424303c086eb4b507f6c7bc7e0c1ba41/hydrus/core/networking/HydrusNetwork.py#L2011

        const m = new Metadata();

        [m.metadata, m.next_update_due] = serializedInfo;

        return m;
    }
}
addSerializableType(Metadata);