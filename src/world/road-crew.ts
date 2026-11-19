// The regular near the entrance knows the way to the side trail.
type RoadTrainer = [name: string, challenge: string, after: string];
interface RoadCrew {
  regular: RoadTrainer;
  optional?: [RoadTrainer, RoadTrainer];
}

export const roadCrews: Record<string, RoadCrew> = {
  "01": {
    regular: ["Scout Ari", "My Caterpie finally stopped chewing my hat. We’re ready for our first proper match!", "There’s a first-aid tin on the little pier. We scouts keep it stocked."],
    optional: [
      ["Picnicker Lou", "There’s a Caterpie just like mine by the pond. Can you spot the difference?", "The one by the pond only eats the soft bits of the leaf."],
      ["Youngster Fen", "My big brother says you have to train on the road. I like it better out here.", "I’m keeping this spot. You can see both paths from here!"],
    ],
  },
  "02": {
    regular: ["Orchard hand Bea", "I’ve got one match until the next cart of windfalls. Your partner ready?", "The packing bench is beside the millrace. We wrap anything fragile there."],
    optional: [
      ["Picker Kit", "Last one to the ford has to sort windfalls. Quick match?", "All right, I’ll take the bruised ones. Sentret likes those best."],
      ["Orchard hand Mae", "Mind the blossom on my sleeve. I’m still on pollination duty!", "The wind strips the pollen on the far row. There’s a brush over by the mill."],
    ],
  },
  "03": {
    regular: ["Surveyor Cleo", "I’m waiting for the lamp crew. Shall we try a match while it’s light?", "My spare Antidotes are by the lamplighter’s rest. Take them into the wood."],
    optional: [
      ["Scout Tavi", "Did you see the eyes in the fork of that tree? I nearly dropped my map.", "Only a Noctowl. It’s been keeping watch longer than I have."],
      ["Keeper’s aide Ivo", "I have to trim those wicks before dark. Time for a quick one!", "Look for the paired blooms when you reach the wood."],
    ],
  },
  "04": {
    regular: ["Ferry hand Dara", "My relief missed the tide. A match will warm us up while we wait.", "You can walk along the clay shelf above the inlet. Keep an eye out for shells."],
    optional: [
      ["Beachcomber Una", "I’ve found four shells today. Think I can find four good moves?", "Are these tooth marks on my best shell? Sandshrew got here first."],
      ["Runner Rex", "I thought I could beat the tide to the next bend. Race you in battle instead?", "The tide has all day. I’ll take the high bank home."],
    ],
  },
  "05": {
    regular: ["Deckhand Emil", "Can’t take the boat out in this fog. My crew still needs exercise!", "The steps stay above the tide. Watch for the little fans of sand down there."],
    optional: [
      ["Wader Linn", "I’ve been counting Krabby holes. A claw pinched my pencil in half!", "The big one makes the smallest sand pellets. How does it do that?"],
      ["Lifeguard Una", "Let’s keep the training above the high-water mark.", "The scratched step was last winter’s tide. I wouldn’t leave my boots there."],
    ],
  },
  "06": {
    regular: ["Lockkeeper Nessa", "There’s time for a match while the middle lock fills.", "A brass float’s caught in the net by the three lock gates. The tinkerer might want that."],
    optional: [
      ["Tughand Hugh", "Match me before the last barge goes through!", "See all three water levels? They meet for just a second when the gates open."],
      ["Fitter Asha", "The magnets on my partner make the lock wheel hum. Stand clear!", "Hear that? The barge is through. Back to the wheel."],
    ],
  },
  "07": {
    regular: ["Mechanic Oren", "The relay’s tripped again. Come on, team. Let’s put that charge somewhere useful.", "The little siding at the signal box is shut. Good place to look for loose parts."],
    optional: [
      ["Signal aide Ada", "Clear track, clear flags. Ready when you are!", "Green flag for you. I’ll hold my next signal a little longer."],
      ["Apprentice Pip", "I salvaged this Poké Ball from a parts bin. It still works!", "There’s a loose pawl stuck to one of the rails. My pliers just stick to it too."],
    ],
  },
  "08": {
    regular: ["Dune guide Iona", "Feel the wind on that ridge? We train in its shadow.", "The lee side of Singing Saddle holds water. Phanpy knows where to dig."],
    optional: [
      ["Walker Hal", "We followed the wind until we found the loudest dune. Hear it?", "The saddle sings in two notes. I can only whistle one."],
      ["Carrier Pia", "I left my cart at the fork. This little pass is just for us walkers!", "The wide road goes around the ridge. I always take this way back."],
    ],
  },
  "09": {
    regular: ["Glass apprentice May", "I’m mapping the glass roots before we lift them. Mind the trench!", "Take the narrow trench. It joins the haul road again past the glass."],
    optional: [
      ["Glazier Poe", "I can lift a glass tube without cracking it. Battling takes a lighter touch.", "Ah. Too heavy-handed again. At least the glass is all right."],
      ["Prospector Bri", "My partner found a sparkling root. Come see after our match!", "Natu’s been looking through that hollow root all morning."],
    ],
  },
  "10": {
    regular: ["Wader Taran", "Let’s wait here for the boards to dry. Fancy a match?", "The hide has a boardwalk right over the feeding pool. Quagsire comes close if you wait."],
    optional: [
      ["Ranger Min", "I’ve got a Quagsire sketch with its mouth closed. I want the other half!", "The bubble comes just before it feeds. Keep your pencil ready."],
      ["Weaver Belle", "My partner cuts reeds. I do the knotting. Both of us battle.", "All the knots on this boardwalk face away from bare feet. I tied them myself."],
    ],
  },
  "11": {
    regular: ["Ranger Kestrel", "We’ll spar in the clearing. The birds in the nesting rows need their quiet.", "Paired poles mark a Farfetch’d nest. Watch the gap beside the ranger blind."],
    optional: [
      ["Birder Ro", "I’ve learned the leek salute. Want a demonstration?", "Farfetch’d kept the leek. I suppose I’m still learning."],
      ["Scout Wynn", "If we duck between the bamboo, nobody at camp can see our secret drills!", "They can hear us, though. I owe the rangers an explanation."],
    ],
  },
  "12": {
    regular: ["Kiln hand Bran", "Last load’s cooling. I’ve got ash on my face and a team itching to battle.", "The old kiln’s full of grass. The one next door is still too hot for boots."],
    optional: [
      ["Collier Nils", "I can read the kiln by the color of the smoke. Let’s see how I read a battle.", "Slugma went that way. See the warm streak in the ash?"],
      ["Courier Vi", "I can shave ten minutes off the ash run. Let’s spend two of them on a match.", "Cut past the kilns. You’ll be back on the cart road before you know it."],
    ],
  },
  "13": {
    regular: ["Prospector Luz", "We use these shelves for practice. Just give the vent a little room.", "There’s a pouch of Burn Heals on the ledge. The miners leave it for whoever needs it."],
    optional: [
      ["Miner Rye", "The rocks are warm enough to dry my gloves. How about a warm-up match too?", "Dry gloves, good match. Back to the freight shift."],
      ["Spotter Ona", "Skarmory barely has to flap above the furnace lip. Nice trick, eh?", "I tried holding my jacket out in the updraft. Didn’t work quite the same."],
    ],
  },
  "14": {
    regular: ["Climber Asa", "I’ve caught my breath. Has your team?", "The cairn marks a sheltered landing off the ridge. Swinub digs its supper there."],
    optional: [
      ["Guide Jed", "Pick your footing before you commit. Works in a battle, too.", "That was a sure step. Mine could use practice."],
      ["Herder Paz", "I can see both springs from here. Promise me the view can wait one match?", "My favorite part is where the warm haze meets the snow."],
    ],
  },
  "15": {
    regular: ["Skater Sanna", "The ice shelf is singing. I’ll keep my skates off until we’re done.", "Look underneath the blue lip. The meltwater goes in a circle."],
    optional: [
      ["Skater Kit", "When the snow cuts up I practice short turns. Your turn first!", "Nice finish. If I tried that turn on skates I’d end up in the bank."],
      ["Ice cutter Bo", "You can see last winter trapped in this slab. Want to see this winter’s team?", "The bubbles go up in a spiral. Must have been moving when it froze."],
    ],
  },
  "16": {
    regular: ["Botanist Eira", "The bronze cup just rang. That’s our starting bell!", "There’s a second chime across the meadow. On a calm day you can hear both."],
    optional: [
      ["Gardener Lio", "Skiploom keeps landing on my seedlings. Show me how to keep its attention?", "Right. Give it somewhere else to land. I’ll plant a row just for it."],
      ["Shepherd Nea", "I’ve got a bell for fog and a bell for supper. Still need a battle bell.", "That last note was supper. You couldn’t have timed it better."],
    ],
  },
  "17": {
    regular: ["Pilgrim Sol", "I’ve tied my ribbon at the gate. One wish for a good match.", "Watch the tree by the gate. Murkrow is stealing ribbons for its nest."],
    optional: [
      ["Pilgrim Lev", "I promised myself one battle for every mile. Got room for mine?", "The miles feel shorter when somebody stops."],
      ["Bell ringer Em", "Hear the tower over the leaves? I start on the next peal.", "The first bell was early today. Or maybe I was late."],
    ],
  },
  "18": {
    regular: ["Nightwatcher Hala", "The terrace is quiet enough to hear your partner breathing. Ready?", "Walk the rim of the mirror pool. The best place to see the stars is on the little pier."],
    optional: [
      ["Stargazer Len", "That bright dot in the pool is a star. The two beside it blinked!", "Eevee looks very pleased with itself. It fooled me too."],
      ["Gardener Rui", "One match before I skim the leaves off the water?", "There we are. The stars will have their mirror back in a minute."],
    ],
  },
  "19": {
    regular: ["Lab aide Nico", "I’ve set the transit pins. My next reading is exactly one match away.", "Look along the brass pins from the platform. The whole line points at the dome."],
    optional: [
      ["Observer Eli", "I thought I’d found a new double star. Then it hopped to the next stone.", "Noctowl has a talent for ruining my measurements."],
      ["Aide Suri", "I’ve checked my notes. All that’s missing is a field trial!", "I’ll put that in ink. Good observations are worth keeping."],
    ],
  },
  "20": {
    regular: ["Mountaineer Liv", "I’ve climbed the last mile a dozen times. This time I feel ready for the League.", "People leave supplies at the cairn for the next challenger. Take what you need."],
    optional: [
      ["Challenger Kel", "My team had butterflies all morning. Mind a practice match?", "Oh! The butterflies are gone. Thanks for stopping."],
      ["Porter Jo", "I carried the supplies up. Now I’ll see how your team travels!", "Someone left their first Poké Ball on the cairn once. I still think about that."],
    ],
  },
  "21": { regular: ["Forester Fenn", "Got through the old grove, did you? Let’s see who travels with you.", "The oak has two ways in. Whichever gap you take, leave the pollen on the bark."] },
  "22": { regular: ["Swimmer Keo", "Race you to the sandbar! Oh, you’re already there. Battle instead?", "The two striped posts line up with the deep channel. The sand between them stays dry."] },
  "23": { regular: ["Excavator Esti", "The saw crew’s on break. Want to hear how a match echoes down the cutting?", "The siding stops at a shell seam. Our preparator keeps a soft brush beside it."] },
  "24": { regular: ["Diver Valea", "The moon pool’s quiet on top. You should see it from underneath!", "Look for a pink branch on the causeway. If it waves, you’ve found Corsola."] },
  "25": { regular: ["Ecologist Ren", "See the young ones following the wind? This is the first quiet migration in years.", "The Chikorita stopped here last season too. Same little nick in its leaf."] },
};
