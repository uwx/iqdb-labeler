import { Kysely, type Migration, type MigrationProvider, sql } from 'kysely'

const migrations: Record<string, Migration> = {}

export const migrationProvider: MigrationProvider = {
    async getMigrations() {
        return migrations
    },
}

migrations['001'] = {
    async up(db: Kysely<unknown>) {
        await db.schema
            .createTable('wikiPages')
            .addColumn('id', 'integer', col => col.primaryKey().notNull())
            .addColumn('title', 'text')
            .addColumn('body', 'text')
            .addColumn('otherNames', 'text', col => col.notNull().defaultTo('[]')) // JSON array
            .addColumn('isDeleted', 'integer')
            .addColumn('isLocked', 'integer')
            .addColumn('updatedAt', 'datetime')
            .addColumn('createdAt', 'datetime')
            .execute()

        await db.schema
            .createIndex('wiki_pages_title_idx')
            .on('wikiPages')
            .column('title')
            .execute()

        await db.schema
            .createTable('tags')
            .addColumn('id', 'integer', col => col.primaryKey().notNull())
            .addColumn('name', 'text')
            .addColumn('words', 'text', col => col.notNull().defaultTo('[]')) // JSON array
            .addColumn('isDeprecated', 'integer')
            .addColumn('updatedAt', 'datetime')
            .addColumn('createdAt', 'datetime')
            .addColumn('category', 'integer')
            .addColumn('postCount', 'integer')
            .addColumn('wikiPageId', 'integer', col => col.references('wikiPages.id'))
            .execute()

        await db.schema
            .createIndex('tags_name_idx')
            .on('tags')
            .column('name')
            .execute()

        await db.schema
            .createIndex('tags_category_idx')
            .on('tags')
            .column('category')
            .execute()

        await db.schema
            .createTable('tagAliases')
            .addColumn('id', 'integer', col => col.primaryKey().notNull())
            .addColumn('forumPostId', 'text')
            .addColumn('forumTopicId', 'integer')
            .addColumn('approverId', 'text')
            .addColumn('creatorId', 'integer')
            .addColumn('updatedAt', 'datetime')
            .addColumn('createdAt', 'datetime')
            .addColumn('status', 'text')
            .addColumn('reason', 'text')
            .addColumn('antecedentName', 'text')
            .addColumn('consequentName', 'text')
            .execute()

        await db.schema
            .createIndex('tagAliases_antecedentName_idx')
            .on('tagAliases')
            .column('antecedentName')
            .execute()

        await db.schema
            .createIndex('tagAliases_consequentName_idx')
            .on('tagAliases')
            .column('consequentName')
            .execute()

        await db.schema
            .createTable('tagImplications')
            .addColumn('id', 'integer', col => col.primaryKey().notNull())
            .addColumn('forumPostId', 'integer')
            .addColumn('forumTopicId', 'integer')
            .addColumn('approverId', 'integer')
            .addColumn('creatorId', 'integer')
            .addColumn('updatedAt', 'datetime')
            .addColumn('createdAt', 'datetime')
            .addColumn('status', 'text')
            .addColumn('reason', 'text')
            .addColumn('antecedentName', 'text')
            .addColumn('consequentName', 'text')
            .execute()

        await db.schema
            .createIndex('tagImplications_antecedentName_idx')
            .on('tagImplications')
            .column('antecedentName')
            .execute()

        await db.schema
            .createIndex('tagImplications_consequentName_idx')
            .on('tagImplications')
            .column('consequentName')
            .execute()

        await db.schema
            .createTable('labels')
            .addColumn('id', 'integer', col => col.primaryKey().notNull())
            .addColumn('src', 'text')
            .addColumn('uri', 'text')
            .addColumn('cid', 'text', col => col.notNull().defaultTo('null'))
            .addColumn('val', 'text')
            .addColumn('neg', 'integer', col => col.notNull().defaultTo(0))
            .addColumn('cts', 'datetime')
            .addColumn('exp', 'datetime', col => col.notNull().defaultTo('null'))
            .addColumn('sig', 'blob', col => col.notNull().defaultTo('null'))
            .execute()

        await db.schema
            .createIndex('labels_uri_idx')
            .on('labels')
            .column('uri')
            .execute()

        await db.schema
            .createIndex('labels_cid_idx')
            .on('labels')
            .column('cid')
            .execute()

        await db.schema
            .createTable('genericdb')
            .addColumn('superkey', 'blob', col => col.notNull())
            .addColumn('key', 'blob', col => col.notNull())
            .addColumn('value', 'blob', col => col.notNull())
            .addColumn('version', 'integer', col => col.notNull())
            .execute()

        await db.schema
            .createIndex('genericdb_superkey_key_idx')
            .on('genericdb')
            .columns(['superkey', 'key'])
            .execute()

        await db.schema
            .createTable('followers')
            .addColumn('did', 'text', col => col.primaryKey().notNull())
            .addColumn('rkey', 'text', col => col.notNull())
            .execute()

        await db.schema
            .createTable('likers')
            .addColumn('did', 'text', col => col.primaryKey().notNull())
            .addColumn('rkey', 'text', col => col.notNull())
            .execute()

        await db.schema
            .createIndex('followers_rkey_idx')
            .on('followers')
            .column('rkey')
            .execute()

        await db.schema
            .createIndex('likers_rkey_idx')
            .on('likers')
            .column('rkey')
            .execute()

        await db.schema
            .createTable('config')
            .addColumn('key', 'text', col => col.primaryKey().notNull())
            .addColumn('value', 'blob', col => col.notNull())
            .execute()

        await db.schema
            .createTable('matches')
            .addColumn('imageUrl', 'text', col => col.primaryKey().notNull())
            .addColumn('similarity', 'real', col => col.notNull())
            .addColumn('md5', 'text')
            .addColumn('sha1', 'text')
            .addColumn('sha256', 'text')
            .addColumn('rating', 'text')
            .addColumn('sourceUrl', 'text')
            .addColumn('pixivId', 'integer')
            .addColumn('fileSize', 'integer')
            .addColumn('tags', 'text') // JSON array of tag IDs
            .execute()

        await sql`PRAGMA journal_mode = WAL;`.execute(db);
    },
    async down(db: Kysely<unknown>) {
        await db.schema.dropTable('tagImpliedBy').execute()
        await db.schema.dropTable('tagImplies').execute()
        await db.schema.dropTable('tagAliasRefs').execute()
        await db.schema.dropTable('tagImplications').execute()
        await db.schema.dropTable('tagAliases').execute()
        await db.schema.dropTable('tags').execute()
        await db.schema.dropTable('wikiPages').execute()
        await db.schema.dropTable('labels').execute()
        await db.schema.dropTable('genericdb').execute()
        await db.schema.dropTable('followers').execute()
        await db.schema.dropTable('likers').execute()
        await db.schema.dropTable('config').execute()

        await sql`PRAGMA journal_mode = DELETE;`.execute(db);
    },
}

migrations['002'] = {
    async up(db: Kysely<unknown>) {
        await db.schema
            .dropIndex('labels_cid_idx')
            .ifExists()
            .execute()
            
        await db.schema
            .dropIndex('labels_uri_idx')
            .ifExists()
            .execute()

        await db.schema
            .alterTable('labels')
            .dropColumn('src')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('uri')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('cid')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('val')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('neg')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('cts')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('exp')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('sig')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('src', 'text', col => col.notNull())
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('uri', 'text', col => col.notNull())
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('cid', 'text', col => col.defaultTo('null'))
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('val', 'text', col => col.notNull())
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('neg', 'integer', col => col.defaultTo(0))
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('cts', 'datetime', col => col.notNull())
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('exp', 'datetime', col => col.defaultTo('null'))
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('sig', 'blob', col => col.notNull())
            .execute()
    },
    async down(db: Kysely<unknown>) {
        await db.schema
            .dropIndex('labels_cid_idx')
            .ifExists()
            .execute()
            
        await db.schema
            .dropIndex('labels_uri_idx')
            .ifExists()
            .execute()

        await db.schema
            .alterTable('labels')
            .dropColumn('src')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('uri')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('cid')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('val')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('neg')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('cts')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('exp')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .dropColumn('sig')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('src', 'text')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('uri', 'text')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('cid', 'text', col => col.notNull().defaultTo('null'))
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('val', 'text')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('neg', 'integer', col => col.notNull().defaultTo(0))
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('cts', 'datetime')
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('exp', 'datetime', col => col.notNull().defaultTo('null'))
            .execute()
            
        await db.schema
            .alterTable('labels')
            .addColumn('sig', 'blob', col => col.notNull().defaultTo('null'))
            .execute()
            
        await db.schema
            .createIndex('labels_uri_idx')
            .on('labels')
            .column('uri')
            .execute()

        await db.schema
            .createIndex('labels_cid_idx')
            .on('labels')
            .column('cid')
            .execute()

    }
}
