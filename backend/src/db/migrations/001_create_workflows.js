export function up(knex) {
  return knex.schema.createTable('workflows', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.text('description');
    table.jsonb('definition').notNullable();
    table.string('status', 50).defaultTo('active');
    table.string('created_by', 255);
    table.integer('version').defaultTo(1);
    table.timestamps(true, true);
    
    table.index('status');
    table.index('created_at');
    table.index('created_by');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('workflows');
}
