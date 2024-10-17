import { EthereumAddress } from '@l2beat/shared-pure'
import { ProjectDiscovery } from '../../../../../../../../discovery/ProjectDiscovery'
import { DaAttestationSecurityRisk } from '../../../../../types/DaAttestationSecurityRisk'
import { DaExitWindowRisk } from '../../../../../types/DaExitWindowRisk'
import { CELESTIA_BLOBSTREAM } from '../template'

const discovery = new ProjectDiscovery('blobstream', 'base')

const chainName = 'Base'
const updateInterval = 1 // hours

const maxRangeDataCommitment = discovery.getContractValue<number>(
  'Blobstream',
  'DATA_COMMITMENT_MAX',
)

const relayers = discovery.getContractValue<string[]>('Blobstream', 'relayers')

const SP1Verifier = discovery.getContractValue<string>(
  'SuccinctGatewaySP1',
  'verifier',
)[0]

export const blobstreamBase = CELESTIA_BLOBSTREAM({
  chain: 'base',
  usedIn: [
    // no project integrates it for state validation
  ],
  display: {
    links: {
      websites: [],
      documentation: ['https://docs.celestia.org/developers/blobstream'],
      repositories: ['https://github.com/succinctlabs/sp1-blobstream'],
      apps: [],
      explorers: ['https://etherscan.io/'],
      socialMedia: [],
    },
  },

  technology: {
    description: `

    ## Architecture
        
    ![Celestia blobstream architecture](/images/da-bridge-technology/celestia/blobstream/architecture.png#center)
    
    The Blobstream bridge is a data availability bridge that facilitates data availability commitments to be bridged between Celestia and ${chainName}.
    The Blobstream bridge is composed of three main components: the **Blobstream** contract, the **Succinct Gateway** contracts, and the **Verifier** contracts.  <br /> 
    By default, Blobstream operates asynchronously, handling requests in a fulfillment-based manner. First, zero-knowledge proofs of Celestia block ranges are requested for proving. Requests can be submitted either off-chain through the Succinct API, or onchain through the requestCall() method of the Succinct Gateway smart contract.
    Alternatively, it is possible to run an SP1 Blobstream operator with local proving, allowing for self-generating the proofs.
    Once a proving request is received, the off-chain prover generates the proof and submits it to Blobstream contract. The Blobstream contract verifies the proof with the corresponding verifier contract and, if successful, stores the data commitment in storage. <br /> 

    Verifying a header range includes verifying tendermint consensus (header signatures are 2/3 of stake) and verifying the data commitment root.
    By default, Blobstream on ${chainName} is updated by the Succinct operator at a regular cadence of ${updateInterval} hour.
    `,
  },
  contracts: {
    addresses: [
      discovery.getContractDetails('Blobstream', {
        description:
          'The Blobstream DA bridge. This contract is used to bridge data commitments between Celestia and Ethereum.',
      }),
      {
        name: 'blobstreamVerifier',
        chain: 'base',
        address: EthereumAddress(SP1Verifier),
        description: `Verifier contract for the header range [latestBlock, targetBlock] proof.
        A request for a header range can be at most ${maxRangeDataCommitment} blocks long. The proof is generated by an off-chain prover and submitted by a relayer.`,
      },
      discovery.getContractDetails('SuccinctGatewaySP1', {
        description: `This contract is the router for the bridge proofs verification. It stores the mapping between the identifier of the bridge circuit and the address of the on-chain verifier contract.
        `,
      }),
      discovery.getContractDetails('SuccinctGateway', {
        description: `Users can interact with this contract to request proofs on-chain, emitting a RequestCall event for off-chain provers to consume.`,
      }),
    ],
    risks: [
      {
        category: 'Funds can be lost if',
        text: 'the bridge contract receives a malicious code upgrade. There is no delay on code upgrades.',
      },
      {
        category: 'Funds can be lost if',
        text: 'a dishonest majority of Celestia validators post incorrect or malicious data commitments.',
      },
    ],
  },
  permissions: [
    ...discovery.getMultisigPermission(
      'BlobstreamMultisig',
      'This multisig is the admin of the Blobstream contract. It holds the power to change the contract state and upgrade the bridge.',
    ),
    ...discovery.getMultisigPermission(
      'SuccinctGatewaySP1Multisig',
      'This multisig is the admin of the SuccinctGatewaySP1 contract. As the manager of router for proof verification, it holds the power to affect the liveness and safety of the bridge.',
    ),
    {
      name: 'Relayers',
      chain: 'base',
      description: `List of prover (relayer) addresses that are allowed to call commitHeaderRange() to commit block ranges to the Blobstream contract.`,
      accounts: relayers.map((relayer) => ({
        address: EthereumAddress(relayer),
        type: 'EOA',
      })),
    },
  ],
  risks: {
    attestations: DaAttestationSecurityRisk.SigVerifiedZK(true),
    exitWindow: DaExitWindowRisk.LowOrNoDelay(0), // TIMELOCK_ROLE is 4/6 multisig
  },
})
