import type { Database as GeneratedDatabase } from "./database.types";

type PublicSchema = GeneratedDatabase["public"];

/**
 * Application database type extensions for RPCs that already exist in the
 * official Supabase project but are not yet present in the checked-in
 * generated database.types.ts snapshot.
 *
 * Keep this file small and remove entries when database.types.ts is regenerated.
 */
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<PublicSchema, "Functions"> & {
    Functions: PublicSchema["Functions"] & {
      add_instagram_story_targets: {
        Args: { p_post_id: string };
        Returns: number;
      };
      attach_cover_to_post: {
        Args: { p_media_asset_id: string; p_post_id: string };
        Returns: number;
      };
      attach_media_items_to_post: {
        Args: { p_media_asset_ids: string[]; p_post_id: string };
        Returns: number;
      };
    };
  };
};
