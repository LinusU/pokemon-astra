import type { Town } from "./atlas";

/** After the town's problem is resolved, the second resident points out the returning visitor. */
interface TownLife {
  square: string;
  directions: string;
  after: string;
  species: number;
  visitor: string;
  observation: string;
  neighbor: string;
}

export const townLife: Record<Town, TownLife> = {
  dewdrop: {
    square: "Seed Exchange", after: "partner", species: 60, visitor: "Pond Poliwag",
    directions: "Take a seed, leave a seed. Alder trades seedlings at the glass-roofed lab north of the flower beds.",
    observation: "Poliwag taps its tail against the bank. Three bubbles reach the surface before it comes up for air.",
    neighbor: "See the ripples behind the pond flowers? A Poliwag slips out whenever Alder starts feeding his new partners.",
  },
  mossford: {
    square: "Press Yard", after: "quest_parcel_complete", species: 165, visitor: "Orchard Ledyba",
    directions: "Pack the apples here. Weigh them at the mill, then take the little bridge to the island shop.",
    observation: "Ledyba brushes floury apple pollen off its antennae. Its other four feet hold tight to the blossom.",
    neighbor: "The next courier brought us blossom cuttings from Bramble. Our first Ledyba has already found the row beside the mill.",
  },
  bramble: {
    square: "Lantern Green", after: "surveyor", species: 48, visitor: "Lantern Venonat",
    directions: "The silkhouse stands below the wooded green. Meet the trail warden across the lane at Lantern Lodge.",
    observation: "Venonat follows the green's lanterns from tree to tree. At the last trunk it turns round and starts again.",
    neighbor: "Our surveyor hung a light on the wooded green. A Venonat does the keeper's evening round now, even in broad daylight.",
  },
  tideglass: {
    square: "Pilots’ Quay", after: "fog_signal", species: 98, visitor: "Pier Krabby",
    directions: "The west pier belongs to the anglers. Leave the east pier clear for the lighthouse crew.",
    observation: "Krabby squeezes a scrap of net between its pincers. A perfect square of knotted twine falls onto the jetty.",
    neighbor: "First boat back brought our net baskets. A Krabby's claimed the end of the angler's pier. We're letting it keep the scraps.",
  },
  copperwick: {
    square: "Dynamo Landing", after: "power_restored", species: 81, visitor: "Towpath Magnemite",
    directions: "Handcarts take the lower bridge to the workshops. Walkers can cross the canal at the wide bridge beside the square.",
    observation: "Magnemite hovers over the lower bridge. Each time it turns, the loose iron filings turn with it.",
    neighbor: "When the pumps started up, the filings on the lower bridge stood on end. Look for the Magnemite above the track.",
  },
  sunspire: {
    square: "Glaziers’ Court", after: "lens_restored", species: 27, visitor: "Oasis Sandshrew",
    directions: "The lens makers work on the far side of the spring. Follow either bank to the Glassworks.",
    observation: "Sandshrew cups a damp wad of sand in its claws. It pats a neat little dome onto the lower bank.",
    neighbor: "Come round the spring. A Sandshrew has been making bowls in the wet sand since the water began flowing again.",
  },
  reedhaven: {
    square: "Reed Landing", after: "ranger_report", species: 194, visitor: "Boardwalk Wooper",
    directions: "The planks fork at the market. The lower walk crosses the marsh to the nursery in the thatched Ranger Cabin.",
    observation: "Wooper rests its chin between the worn boards. The ripple under its tail sways the reed stems one by one.",
    neighbor: "We raised the lower walkway for the water survey. There's a Wooper on the planks by the market every time I cross.",
  },
  cinderfall: {
    square: "Kiln Yard", after: "pokemon_freed", species: 218, visitor: "Bathhouse Slugma",
    directions: "Flint keeps the refuge under the twin stacks above the yard. The spring terrace and mine road are uphill.",
    observation: "Slugma dozes under the spring outlet. Water beads hiss into steam wherever its back touches the pipe.",
    neighbor: "One of Flint's patients has found the spring outlet. Follow the steam to see a Slugma taking the warmest seat.",
  },
  rimepeak: {
    square: "Pass Terrace", after: "pass_open", species: 220, visitor: "Silverleaf Swinub",
    directions: "The little blue awning below this terrace marks the Pass Shelter. Meltwater feeds the spa just beside its door.",
    observation: "Swinub pushes its nose into a melt hole. It comes up with a root and a tiny cap of snow balanced between its ears.",
    neighbor: "Mossford’s healer needs Frostvault silverleaf. A Swinub is already nosing round the melt ring below the spring. It can smell the roots!",
  },
  bellweather: {
    square: "Watch Court", after: "revelation", species: 163, visitor: "Choir Hoothoot",
    directions: "The bell over Lyra’s gym faces the garden. For the Meridian loading dock, take the street east of the tower.",
    observation: "Hoothoot rocks on one foot for two beats. On the third, its other foot comes down in the clover.",
    neighbor: "The tower has its old peal again. A Hoothoot in the garden keeps the time, whether the keeper pulls the ropes or not.",
  },
  aster: {
    square: "Meridian Garden", after: "engine_stopped", species: 35, visitor: "Garden Clefairy",
    directions: "The chart makers share a wall with the Center. The narrow path at their door winds back to the survey pool.",
    observation: "Clefairy circles a patch of sky reflected in the survey pool. When a leaf breaks the reflection, it waits for the water to settle.",
    neighbor: "We used to polish that pool so we could see the stars. Now a Clefairy comes to dance beside it. The polish can wait.",
  },
  crown: {
    square: "Keepers’ Court", after: "champion", species: 176, visitor: "Summit Togetic",
    directions: "Eight keepers laid this court. League registration is straight ahead under the banners. Reach the ascent from the eastern terrace.",
    observation: "Togetic coasts just above the summit flowers. Each gust lifts it a little higher before it folds its wings.",
    neighbor: "When Mira signed your entry, a Togetic drifted onto the flower terrace below the Center. It must have heard the applause.",
  },
};
