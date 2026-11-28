<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the CargoTrace / DND Atlas Worldwide database (Brief Slide 14 & Slide 22).
     * Executes the complete relational seed from database/mysql_schema_and_seed.sql.
     */
    public function run(): void
    {
        $sqlPath = database_path('mysql_schema_and_seed.sql');
        if (File::exists($sqlPath)) {
            DB::unprepared(File::get($sqlPath));
        }
    }
}
