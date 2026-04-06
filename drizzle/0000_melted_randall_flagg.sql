CREATE TABLE IF NOT EXISTS "game_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"review_id" integer NOT NULL,
	"cognitive_score" real,
	"social_emotional_score" real,
	"motor_score" real,
	"bds" real,
	"dopamine_risk" real,
	"monetization_risk" real,
	"social_risk" real,
	"content_risk" real,
	"ris" real,
	"time_rec_minutes" integer,
	"time_rec_label" varchar(100),
	"time_rec_reasoning" text,
	"time_rec_color" varchar(10),
	"recommended_min_age" integer,
	"top_benefits" jsonb,
	"calculated_at" timestamp DEFAULT now(),
	CONSTRAINT "game_scores_game_id_unique" UNIQUE("game_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"rawg_id" integer,
	"igdb_id" integer,
	"developer" varchar(255),
	"publisher" varchar(255),
	"release_date" timestamp,
	"genres" jsonb DEFAULT '[]'::jsonb,
	"platforms" jsonb DEFAULT '[]'::jsonb,
	"esrb_rating" varchar(10),
	"pegi_rating" integer,
	"metacritic_score" integer,
	"avg_playtime_hours" real,
	"background_image" text,
	"base_price" real,
	"base_price_currency" varchar(3) DEFAULT 'USD',
	"has_microtransactions" boolean DEFAULT false,
	"has_loot_boxes" boolean DEFAULT false,
	"has_subscription" boolean DEFAULT false,
	"has_battle_pass" boolean DEFAULT false,
	"requires_internet" varchar(20),
	"has_stranger_chat" boolean DEFAULT false,
	"chat_moderation" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata_last_synced" timestamp,
	CONSTRAINT "games_slug_unique" UNIQUE("slug"),
	CONSTRAINT "games_rawg_id_unique" UNIQUE("rawg_id"),
	CONSTRAINT "games_igdb_id_unique" UNIQUE("igdb_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviewers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'community',
	"bio" text,
	"review_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "reviewers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"reviewer_id" integer,
	"review_tier" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'draft',
	"problem_solving" integer,
	"spatial_awareness" integer,
	"strategic_thinking" integer,
	"critical_thinking" integer,
	"memory_attention" integer,
	"creativity" integer,
	"reading_language" integer,
	"math_systems" integer,
	"learning_transfer" integer,
	"adaptive_challenge" integer,
	"teamwork" integer,
	"communication" integer,
	"empathy" integer,
	"emotional_regulation" integer,
	"ethical_reasoning" integer,
	"positive_social" integer,
	"hand_eye_coord" integer,
	"fine_motor" integer,
	"reaction_time" integer,
	"physical_activity" integer,
	"variable_rewards" integer,
	"streak_mechanics" integer,
	"loss_aversion" integer,
	"fomo_events" integer,
	"stopping_barriers" integer,
	"notifications" integer,
	"near_miss" integer,
	"infinite_play" integer,
	"escalating_commitment" integer,
	"variable_reward_freq" integer,
	"spending_ceiling" integer,
	"pay_to_win" integer,
	"currency_obfuscation" integer,
	"spending_prompts" integer,
	"child_targeting" integer,
	"ad_pressure" integer,
	"subscription_pressure" integer,
	"social_spending" integer,
	"social_obligation" integer,
	"competitive_toxicity" integer,
	"stranger_risk" integer,
	"social_comparison" integer,
	"identity_self_worth" integer,
	"privacy_risk" integer,
	"violence_level" integer,
	"sexual_content" integer,
	"language_content" integer,
	"substance_ref" integer,
	"fear_horror" integer,
	"est_monthly_cost_low" real,
	"est_monthly_cost_high" real,
	"min_session_minutes" integer,
	"has_natural_stopping_points" boolean,
	"penalizes_breaks" boolean,
	"stopping_points_desc" text,
	"benefits_narrative" text,
	"risks_narrative" text,
	"parent_tip" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"approved_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_reviewers_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."reviewers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "slug_idx" ON "games" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "title_idx" ON "games" ("title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_game_idx" ON "reviews" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_status_idx" ON "reviews" ("status");