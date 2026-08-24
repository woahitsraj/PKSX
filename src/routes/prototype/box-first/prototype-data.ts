export interface PrototypePokemon {
	name: string;
	level: number;
	sprite: string;
	tone: string;
	types: string;
	moves: string[];
}

const pokemon = (
	name: string,
	level: number,
	species: string,
	tone: string,
	types: string,
	moves: string[]
): PrototypePokemon => ({
	name,
	level,
	sprite: `/sprites/pokemon/species/${species}-form-00-sex-default-normal.png`,
	tone,
	types,
	moves
});

export const party = [
	pokemon('Charizard', 68, '0006', 'fire', 'Fire / Flying', ['Flamethrower', 'Air Slash']),
	pokemon('Pikachu', 54, '0025', 'electric', 'Electric', ['Thunderbolt', 'Quick Attack']),
	pokemon('Alakazam', 61, '0065', 'psychic', 'Psychic', ['Psychic', 'Recover']),
	pokemon('Gyarados', 57, '0130', 'water', 'Water / Flying', ['Waterfall', 'Ice Fang']),
	pokemon('Dragonite', 64, '0149', 'dragon', 'Dragon / Flying', ['Dragon Claw', 'Roost']),
	pokemon('Umbreon', 49, '0197', 'dark', 'Dark', ['Foul Play', 'Moonlight'])
];

const residents = [
	...party,
	pokemon('Machamp', 52, '0068', 'fighting', 'Fighting', ['Cross Chop', 'Knock Off']),
	pokemon('Gardevoir', 58, '0282', 'psychic', 'Psychic / Fairy', ['Moonblast', 'Calm Mind']),
	pokemon('Lucario', 63, '0448', 'steel', 'Fighting / Steel', ['Aura Sphere', 'Flash Cannon']),
	pokemon('Metagross', 66, '0376', 'steel', 'Steel / Psychic', ['Meteor Mash', 'Zen Headbutt']),
	pokemon('Tyranitar', 62, '0248', 'rock', 'Rock / Dark', ['Stone Edge', 'Crunch']),
	pokemon('Rayquaza', 72, '0384', 'dragon', 'Dragon / Flying', ['Dragon Ascent', 'Extreme Speed'])
];

const occupiedSlots = new Map([
	[0, residents[0]],
	[1, residents[6]],
	[2, residents[7]],
	[4, residents[1]],
	[6, residents[3]],
	[7, residents[8]],
	[8, residents[2]],
	[9, residents[9]],
	[12, residents[10]],
	[13, residents[4]],
	[14, residents[11]],
	[18, residents[5]],
	[20, residents[7]],
	[24, residents[8]],
	[27, residents[3]]
]);

export const boxSlots = Array.from({ length: 30 }, (_, index) => occupiedSlots.get(index) ?? null);

export const initialPokemon = boxSlots[14] ?? party[0];
