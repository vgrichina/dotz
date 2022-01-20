import 'regenerator-runtime/runtime'
import React from 'react'
import * as timeago from 'timeago.js';
import { login, logout } from './utils'
import './global.css'

import getConfig from './config'
import { utils } from 'near-api-js'
const { networkId } = getConfig(process.env.NODE_ENV || 'development')

const WEB4_PREFIX = process.env.WEB4_PREFIX || 'https://dotz.near.page';

export default function App() {
  const [username, setUsername] = React.useState()
  const [teamVotes, setTeamVotes] = React.useState([])
  const [timeUntilVote, setTimeUntilVote] = React.useState()
  const [submitting, setSubmitting] = React.useState()
  const [hasToken, setHasToken] = React.useState()

  // when the user has not yet interacted with the form, disable the button
  const [buttonDisabled, setButtonDisabled] = React.useState(true)

  // after submitting the form, we want to show Notification
  const [showNotification, setShowNotification] = React.useState(false)

  const canVote = !submitting && timeUntilVote === '0'

  const refresh = () => {
    const { walletConnection, contract, accountId } = window;

    if (walletConnection.isSignedIn()) {

      // contract is set by initContract in index.js
      contract.getTwitterUsername({ accountId: accountId })
        .then(usernameFromContract => {
          setUsername(usernameFromContract)
        })

      contract.nft_supply_for_owner({ account_id: accountId })
        .then(supply => {
          setHasToken(supply > 0);
        })

      contract.getTeamVotes()
        .then(teamVotes => {
          console.log('teamVotes', teamVotes);
          setTeamVotes(teamVotes)
        })

      contract.getTimeUntilVote({ accountId: accountId })
        .then(timeUntilVote => {
          setTimeUntilVote(timeUntilVote)
        })
    }
  }

  // The useEffect hook can be used to fire side-effects during render
  // Learn more: https://reactjs.org/docs/hooks-intro.html
  React.useEffect(
    refresh,

    // The second argument to useEffect tells React when to re-run the effect
    // Use an empty array to specify "only run on first render"
    // This works because signing into NEAR Wallet reloads the page
    []
  )

  // if not signed in, return early with sign-in prompt
  if (!window.walletConnection.isSignedIn()) {
    return (
      <main>
        <h1>Welcome to <code>.near</code> club NFT drop</h1>
        <p>
          To claim the NFT drop, you need to sign in. The button
          below will sign you in using NEAR Wallet.
        </p>
        <p>
          Go ahead and click the button below to try it out:
        </p>
        <p style={{ textAlign: 'center', marginTop: '2.5em' }}>
          <button onClick={login}>Sign in</button>
        </p>
      </main>
    )
  }

  return (
    // use React Fragment, <>, to avoid wrapping elements in unnecessary divs
    <>
      <button className="link" style={{ float: 'right' }} onClick={logout}>
        Sign out
      </button>
      <main>
        <h1>
          Hello
          {' '/* React trims whitespace around tags; insert literal space character when needed */}
          {window.accountId}!
        </h1>
        {!hasToken
          ? <>
            { username
              ? <p>You've already connected <a href={`https://twitter.com/${username}`}>{username}</a> Twitter account. You can update to use different Twitter account:</p>
              : <p>Claim your <code>.near</code> club membership using these instructions:</p>
            }
            <ol>
              <li>
                Change your account name in Twitter to include your <code>.near</code> username, e.g. <b>Illia Polosukhin (root.near)</b>.
              </li>
              <li>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  'Check out this NFT drop: https://twitter.com/vgrichina/status/1442392328610598915?s=20\n\n#dotnearfollowdotnear')}`}>
                  Tweet</a> about this project, including <code>#dotnearfollowdotnear</code> hashtag.
              </li>
              <li>
                Submit your request in the form below (includes 0.05 NEAR fee to cover the <a href="https://docs.near.org/docs/concepts/storage-staking">storage costs</a>)
              </li>
              <li>
                Wait for <b>few days</b> until you receive NFT in the wallet. Keep your .near account name on Twitter.
              </li>
              <li>
                NFT you get is dynamic and generated fully on chain. It'll keep updating as we grow .near community.
              </li>
            </ol>

            {username && <p>
              Note that <b>you've already submitted</b> your username as it is displayed in the form below.
              You can submit again to update it in case you made a mistake.
            </p>}

            <form onSubmit={async event => {
              event.preventDefault()

              // get elements from the form using their id attribute
              const { fieldset, username } = event.target.elements

              // hold onto new user-entered value from React's SynthenticEvent for use after `await` call
              const newUsername = username.value

              // disable the form while the value gets updated on-chain
              fieldset.disabled = true

              try {
                // make an update call to the smart contract
                const BOATLOAD_OF_GAS = '300000000000000';
                const FEE = utils.format.parseNearAmount('0.05');
                await window.contract.setTwitterUsername({
                  username: newUsername
                }, BOATLOAD_OF_GAS, FEE);
              } catch (e) {
                alert(
                  'Something went wrong! ' +
                  'Maybe you need to sign out and back in? ' +
                  'Check your browser console for more info.'
                )
                throw e
              } finally {
                // re-enable the form, whether the call succeeded or failed
                fieldset.disabled = false
              }

              // update local `username` variable to match persisted value
              setUsername(newUsername)

              // show Notification
              setShowNotification(true)

              // remove Notification again after css animation completes
              // this allows it to be shown again next time the form is submitted
              setTimeout(() => {
                setShowNotification(false)
              }, 11000)
            }}>
              <fieldset id="fieldset">
                <label
                  htmlFor="username"
                  style={{
                    display: 'block',
                    color: 'var(--gray)',
                    marginBottom: '0.5em'
                  }}
                >
                  Your Twitter username (one that starts with @).
                </label>
                <div style={{ display: 'flex' }}>
                  <input
                    autoComplete="off"
                    defaultValue={username}
                    id="username"
                    onChange={e => setButtonDisabled(e.target.value === username)}
                    style={{ flex: 1 }}
                  />
                </div>
                <button
                  disabled={buttonDisabled}
                  style={{ borderRadius: '0 5px 5px 0' }}
                >
                  Save
                </button>
              </fieldset>
            </form>
          </>
        : <>
          <h2>Your NFT</h2>
          <img src={`${WEB4_PREFIX}/img/${accountId}`} width="100%" />
        </>}

        <h2>Team leaderboard</h2>
        <ul>
          { [...teamVotes]
              .sort((a, b) => b.votes - a.votes)
              .map(({ team, votes }) => <li key={team}>{ team } – { votes }</li>)}
        </ul>

        <h2>Rules</h2>
        <ul>
          <li>Vote for your team once per day</li>
          <li>Add your team color emoji to your Twitter username</li>
          <li>Team which gets most votes wins</li>
        </ul>

        {hasToken && 
          <>
            { !canVote && timeUntilVote != null && <p>You can vote again: {timeago.format(Date.now() + timeUntilVote / 1000_000)} </p>}

            <button
              disabled={!canVote}
              style={{ borderRadius: '0 5px 5px 0' }}
              onClick={async event => {
                setTimeUntilVote(null);
                setSubmitting(true);
                try {
                  await window.contract.vote();
                } catch (e) {
                  setSubmitting(false);
                }
                refresh();
              }}
            >
              Vote
            </button>
          </>}

        <hr />
        <p>
          To see how to make apps like this, check out <a target="_blank" rel="noreferrer" href="https://docs.near.org">the NEAR docs</a> or look through some <a target="_blank" rel="noreferrer" href="https://examples.near.org">example apps</a>.
        </p>
      </main>
      {showNotification && <Notification />}
    </>
  )
}

// this component gets rendered by App after the form is submitted
function Notification() {
  const urlPrefix = `https://explorer.${networkId}.near.org/accounts`
  return (
    <aside>
      <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.accountId}`}>
        {window.accountId}
      </a>
      {' '/* React trims whitespace around tags; insert literal space character when needed */}
      called method: 'setTwitterUsername' in contract:
      {' '}
      <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.contract.contractId}`}>
        {window.contract.contractId}
      </a>
      <footer>
        <div>✔ Succeeded</div>
        <div>Just now</div>
      </footer>
    </aside>
  )
}
