"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function createEventsTable() {
    console.log('Creating events table...');
    const { Pool } = pg_1.default;
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    try {
        // Create events table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        department_id uuid NOT NULL,
        admin_id uuid NOT NULL,
        title varchar(255) NOT NULL,
        description text,
        event_date timestamp NOT NULL,
        end_date timestamp,
        location varchar(255),
        event_image_url text,
        event_link text,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
        console.log('Events table created');
        // Add foreign key constraints - check first if they exist
        try {
            await pool.query(`
        ALTER TABLE events ADD CONSTRAINT events_department_id_departments_id_fk 
        FOREIGN KEY (department_id) REFERENCES departments(id);
      `);
            console.log('Department FK constraint added');
        }
        catch (err) {
            if (err.code === '42710') {
                console.log('Department FK constraint already exists');
            }
            else {
                throw err;
            }
        }
        try {
            await pool.query(`
        ALTER TABLE events ADD CONSTRAINT events_admin_id_users_id_fk 
        FOREIGN KEY (admin_id) REFERENCES users(id);
      `);
            console.log('Admin FK constraint added');
        }
        catch (err) {
            if (err.code === '42710') {
                console.log('Admin FK constraint already exists');
            }
            else {
                throw err;
            }
        }
        console.log('Events table setup completed successfully!');
    }
    catch (error) {
        console.error('Error creating events table:', error);
    }
    finally {
        await pool.end();
        process.exit(0);
    }
}
createEventsTable();
