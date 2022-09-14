import { Context, PersistentUnorderedMap, MapEntry, logging, storage, util, math } from 'near-sdk-as'
import { bodyUrl, Web4Request, Web4Response } from './web4'

const VOTE_COOLDOWN: u64 = 24 * 60 * 60 * 1000_000_000; // in nanoseconds
const TEAMS = ['🔴 red', '🟢 green', '🟣 purple'];

export function renderNFT(accountId: string): string {
  let seed = math.hash(accountId);
  let h1 = seed[0];
  let h2 = seed[1];
  let cx = f64(seed[2]) / 255.;
  let cy = f64(seed[3]) / 255.;
  let r = (f64(seed[4]) / 255.) * 0.7 + 1;
  let s1 = seed[5] % 80 + 20;
  let s2 = seed[6] % 80 + 20;

  const winning = 'winning 🏆';
  const losing = 'losing 💩';
  const teamIndex = seed[7] % TEAMS.length;
  const team = TEAMS[teamIndex];
  const winningTeamIndex = storage.getPrimitive<i32>('winning-team', -1);
  const result = teamIndex == winningTeamIndex ? winning : losing;

  const svg = `
    <svg width="512" height="512" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <defs>
          <radialGradient id="RadialGradient2" cx="${cx}" cy="${cy}" r="${r}">
            <stop offset="0%" stop-color="hsl(${h1}, ${s1}%, 50%)"/>
            <stop offset="100%" stop-color="hsl(${h2}, ${s2}%, 70%)"/>
          </radialGradient>
      </defs>
      <rect x="0" y="0" rx="15" ry="15" width="100%" height="100%" fill="url(#RadialGradient2)">
      </rect>
      <text x="50%" y="48" style="font-family: sans-serif; font-size: 24px; fill: white;" text-anchor="middle" >${team} team is ${result}</text>
      <text x="50%" y="96" style="font-family: sans-serif; font-size: 24px; fill: white;" text-anchor="middle" >Play at dotz.near.page</text>
      <text x="50%" y="464" style="font-family: sans-serif; font-size: 48px; fill: white;" text-anchor="middle" >${accountId}</text>
    </svg>
  `;
  return svg;
}

const NFT_SPEC = 'nft-1.0.0'
const NFT_NAME = '.near club'
const NFT_SYMBOL = 'dotNEAR'

@nearBindgen
class TokenMetadata {
  constructor(
    public title: string,
    public description: string,
    public copies: u8,
    public media: string,
    // public media_hash: string = '',
    public issued_at: u64,
    // public expires_at: string = '',
    // public starts_at: string = '',
    // public updated_at: string = '',
    // public extra: string = '',
    // public reference: string = '',
    // public reference_hash: string = ''
  ) { }
}

@nearBindgen
class NFTContractMetadata {
  constructor(
    public spec: string = NFT_SPEC,
    public name: string = NFT_NAME,
    public symbol: string = NFT_SYMBOL,
    public icon: string = '',
    // public base_uri: string = '',
    // public reference: string = '',
    // public reference_hash: string = '',
  ) { }
}

@nearBindgen
class Token {
    id: string
    owner_id: string
    creator: string
    metadata: TokenMetadata

    constructor(creator: string, issued_at: u64) {
      this.id = creator;
      this.creator = creator;
      this.owner_id = creator;

      const title = `${creator}'s club card`;

      const copies: u8 = 1

      let media = `http://localhost:3000/img/${creator}`;
      if (Context.contractName.endsWith('.near') || Context.contractName.endsWith('.testnet')) {
        media = `https://${Context.contractName}.page/img/${creator}`;
      }
      this.metadata = new TokenMetadata(
          title,
          `.near club card`,
          copies,
          media,
          issued_at,
      )
    }
}

const minted = new PersistentUnorderedMap<string, u64>('minted');
const twitterUsernames = new PersistentUnorderedMap<string, string>('twitter');

export function setTwitterUsername(username: string): void {
  twitterUsernames.set(Context.sender, username);
}

export function getTwitterUsername(accountId: string): string | null {
  return twitterUsernames.get(accountId);
}

export function web4_get(request: Web4Request): Web4Response {
  if (request.path.startsWith('/img')) {
    const parts = request.path.split('/');
    assert(parts.length == 3);
    const accountId = parts[2];
    // TODO: Validate account ID more thoroughly to make sure code cannot be injected
    assert(!accountId.includes('&') && !accountId.includes('<'));
    const svg = renderNFT(accountId);
    return { contentType: 'image/svg+xml; charset=UTF-8', body: util.stringToBytes(svg) };
  }

  return bodyUrl(`ipfs://bafybeibbw4lwftmc5qp3qvixf6sy3xqizyydedj6h5wpt3uq5vtgs42xue${request.path}`);
}

export function nft_token(token_id: string): Token | null {
  if (!minted.contains(token_id)) {
    return null;
  }

  const issued_at = minted.getSome(token_id);
  return new Token(token_id, issued_at);
}

export function nft_total_supply(): u64 {
  return minted.length;
}

export function nft_tokens(from_index: u64 = 0, limit: u8 = 0): Token[] {
  let entries: MapEntry<string, u64>[] = minted.entries(<i32>from_index, <i32>limit || minted.length);
  let tokens: Array<Token> = []

  for (let i = 0; i < entries.length; i++) {
    tokens.push(nft_token(entries[i].key)!);
  }

  return tokens
}

export function nft_supply_for_owner(account_id: string): u64 {
  if (!minted.contains(account_id)) {
    return 0;
  }

  return 1;
}

export function nft_tokens_for_owner(
  account_id: string,
  from_index: u64 = 0,
  limit: u8 = 0
): Token[] {
  if (!minted.contains(account_id) || from_index > 0 || limit < 1) {
    return [];
  }

  return [nft_token(account_id)!];
}

export function nft_metadata(): NFTContractMetadata {
  return new NFTContractMetadata();
}

// TODO: Non-standard, check what other apps ended up using
export function nft_mint_to(receiver_id: string): void {
  assert(Context.sender == Context.contractName, 'Can only be called by owner');
  assert(!minted.contains(receiver_id), `${receiver_id} minted already`);

  minted.set(receiver_id, Context.blockTimestamp);
}

export function vote(): void {
  const accountId = Context.sender;
  assert(minted.contains(accountId), `${accountId} didn't mint NFT`);
  assert(getTimeUntilVote(accountId) == 0, 'not enough time since last vote')

  let seed = math.hash(accountId);
  const teamIndex = seed[7] % TEAMS.length;

  let votes = storage.get<u64[]>('team-votes', [0, 0, 0])!;
  votes[teamIndex]++;
  storage.set('team-votes', votes);

  let winningTeam = 0;
  for (let i = 0; i < votes.length; i++) {
    if (votes[winningTeam] < votes[i]) {
      winningTeam = i;
    }
  }

  storage.set('winning-team', winningTeam);
  storage.set(`last-vote:${accountId}`, Context.blockTimestamp);
}

@nearBindgen
class TeamVotes {
  team: string;
  votes: u64;
}

export function getTimeUntilVote(accountId: string): u64 {
  const lastVoteKey = `last-vote:${accountId}`;
  const lastVoteTime = storage.getPrimitive<u64>(lastVoteKey, 0);
  const timeAfterLastVote = Context.blockTimestamp - lastVoteTime;
  return timeAfterLastVote > VOTE_COOLDOWN ? 0 : VOTE_COOLDOWN - timeAfterLastVote;
}

export function getTeamVotes(): TeamVotes[] {
  let votes = storage.get<u64[]>('team-votes', [0, 0, 0])!;
  let teamVotes: TeamVotes[] = [];
  for (let i = 0; i < votes.length; i++) {
    teamVotes.push({
      team: TEAMS[i],
      votes: votes[i]
    })
  }
  return teamVotes;
}