import { gameLike } from "$lib/likeContent";
import { kazwireAPI } from "$lib/kazwireAPI";

import type { Game } from "@prisma/client";

// Must be intiialized on the client side
class Suggest {
	PlayGame(id: string): void {
		let playedGames: string[] | null = localStorage.getItem("playedGames");
		if (playedGames == null) {
			playedGames = [];
		} else {
			playedGames = JSON.parse(playedGames);
		}

		playedGames.push(id);

		// Dont allow duplicates just push them to the start
		playedGames = [...new Set(playedGames)];

		// Only allow 50 games to be stored
		if (playedGames.length > 50) {
			playedGames = playedGames.slice(0, 50);
		}

		localStorage.setItem("playedGames", JSON.stringify(playedGames));
	}

	Games(): Promise<Game[]> {
		let games = kazwireAPI.fetchGames();

		let likes = gameLike.fetchLikes();

		let playedGames = localStorage.getItem("playedGames");
		if (playedGames == null) {
			playedGames = JSON.stringify([]);
		} else {
			playedGames = JSON.parse(playedGames)
		}

		// Create algorithm to suggest games
		// A value (0 [will not like the game at all] to 1 [will love the game]) will be assigned to each game based on the following:
		// Priority 1: Liked games
		// Priority 2: Played games
		// Priority 3: Games with similar tags to liked games
		// Priority 4: Games with similar tags to played games
		// Priority 5: Games with similar emulator to liked games
		// Priority 6: Games with similar emulator to played games

		// Go through each game and assign a score after the promise is resolved
		return Promise.all([games, likes]).then((values) => {
			// Have a score object to store the score of each game separately
			let score: { [key: string]: number } = {};

			let promiseGames = values[0];
			let promiseLikes = values[1];

			// Assign a score to each game
			promiseGames.forEach((game) => {
				// Assign a score of 0 to each game
				score[game.id] = 0;
			});

			// Assign a score to each game based on the likes
			const LIKED_GAME_SCORE = 0.6;
			for (let i = 0; i < promiseLikes.length; i++) {
				let like = promiseLikes[i];

				// If the game is liked, add LIKED_GAME_SCORE to the score
				score[like] += LIKED_GAME_SCORE;
			}

			// Assign a score to each game based on the played games
			const PLAYED_GAME_SCORE = 0.4;
			for (let i = 0; i < playedGames.length; i++) {
				let playedGame = playedGames[i];

				// If the game is played, add PLAYED_GAME_SCORE to the score
				score[playedGame] += PLAYED_GAME_SCORE;
			}

			// Assign a score to each game based on the tags of the liked games
			const LIKED_TAG_SCORE = 0.1;
			for (let i = 0; i < promiseLikes.length; i++) {
				let like = promiseLikes[i];

				// Get the tags of the liked game
				let likeTags = promiseGames.find((game) => game.id == like)?.tags;

				// If the game has tags, add LIKED_TAG_SCORE to the score of each game with the same tag
				if (likeTags != null) {
					for (let j = 0; j < likeTags.length; j++) {
						let likeTag = likeTags[j];

						// Get the games with the same tag
						let gamesWithTag = promiseGames.filter((game) => game.tags.includes(likeTag));

						// Add 0.05 to the score of each game with the same tag
						for (let k = 0; k < gamesWithTag.length; k++) {
							let gameWithTag = gamesWithTag[k];

							score[gameWithTag.id] += LIKED_TAG_SCORE;
						}
					}
				}
			}

			// Assign a score to each game based on the tags of the played games
			const PLAYED_TAG_SCORE = 0.05;
			for (let i = 0; i < playedGames.length; i++) {
				let playedGame = playedGames[i];

				// Get the tags of the played game
				let playedGameTags = promiseGames.find((game) => game.id == playedGame)?.tags;

				// If the game has tags, add PLAYED_TAG_SCORE to the score of each game with the same tag
				if (playedGameTags != null) {
					for (let j = 0; j < playedGameTags.length; j++) {
						let playedGameTag = playedGameTags[j];

						// Get the games with the same tag
						let gamesWithTag = promiseGames.filter((game) => game.tags.includes(playedGameTag));

						// Add 0.01 to the score of each game with the same tag
						for (let k = 0; k < gamesWithTag.length; k++) {
							let gameWithTag = gamesWithTag[k];

							score[gameWithTag.id] += PLAYED_TAG_SCORE;
						}
					}
				}
			}

			// Assign a score based on the similarity of the emulator to the liked games
			const LIKED_EMULATOR_SCORE = 0.15;
			for (let i = 0; i < promiseLikes.length; i++) {
				let like = promiseLikes[i];

				// Get the emulator of the liked game
				let likeEmulator = promiseGames.find((game) => game.id == like)?.emulatorType;

				// If the game has an emulator, add LIKED_EMULATOR_SCORE to the score of each game with the same emulator
				if (likeEmulator != null) {
					// Get the games with the same emulator
					let gamesWithEmulator = promiseGames.filter((game) => game.emulatorType == likeEmulator);

					// Add LIKED_EMULATOR_SCORE to the score of each game with the same emulator
					for (let j = 0; j < gamesWithEmulator.length; j++) {
						let gameWithEmulator = gamesWithEmulator[j];

						score[gameWithEmulator.id] += LIKED_EMULATOR_SCORE;
					}
				}
			}

			// Assign a score based on the similarity of the emulator to the played games
			const PLAYED_EMULATOR_SCORE = 0.1;
			for (let i = 0; i < playedGames.length; i++) {
				let playedGame = playedGames[i];

				// Get the emulator of the played game
				let playedGameEmulator = promiseGames.find((game) => game.id == playedGame)?.emulatorType;

				// If the game has an emulator, add PLAYED_EMULATOR_SCORE to the score of each game with the same emulator
				if (playedGameEmulator != null) {
					// Get the games with the same emulator
					let gamesWithEmulator = promiseGames.filter((game) => game.emulatorType == playedGameEmulator);

					// Add PLAYED_EMULATOR_SCORE to the score of each game with the same emulator
					for (let j = 0; j < gamesWithEmulator.length; j++) {
						let gameWithEmulator = gamesWithEmulator[j];
						
						score[gameWithEmulator.id] += PLAYED_EMULATOR_SCORE;
					}
				}
			}

			// Sort the games by score
			let sortedGames = promiseGames.sort((a, b) => {
				return score[b.id] - score[a.id];
			});

			const SCORE_THRESHOLD = 0.03;
			sortedGames = sortedGames.filter((game) => {
				return score[game.id] > SCORE_THRESHOLD;
			});

			const MAX_GAMES = 10;
			if (sortedGames.length > MAX_GAMES) {
				console.log("Suggesting games");
				console.log(sortedGames.slice(0, MAX_GAMES));
				return sortedGames.slice(0, MAX_GAMES);
			} else {
				console.log("Suggesting games");
				console.log(sortedGames);
				return sortedGames;
			}
		});
	}
}

export const suggest = new Suggest();