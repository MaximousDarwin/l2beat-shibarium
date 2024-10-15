import { UnixTime } from '@l2beat/shared-pure'
import { NO_BRIDGE } from '../../templates/no-bridge-template'
import { DaEconomicSecurityRisk } from '../../types/DaEconomicSecurityRisk'
import { DaFraudDetectionRisk } from '../../types/DaFraudDetectionRisk'
import { DaLayer } from '../../types/DaLayer'
import { DasErasureCodingProof } from '../../types/DasErasureCodingProof'
import { DasErasureCodingScheme } from '../../types/DasErasureCodingScheme'
import { linkByDA } from '../../utils/link-by-da'
import { blobstream } from './bridges/blobstream'

export const celestia: DaLayer = {
  id: 'celestia',
  type: 'DaLayer',
  kind: 'PublicBlockchain',
  systemCategory: 'public',
  display: {
    name: 'Celestia',
    slug: 'celestia',
    description:
      'Celestia is a modular data availability network that allows scaling solutions to post arbitrary data as blobs.',
    links: {
      websites: ['https://celestia.org/'],
      documentation: ['https://docs.celestia.org/'],
      repositories: ['https://github.com/celestiaorg'],
      apps: [],
      explorers: ['https://celenium.io/'],
      socialMedia: [
        'https://x.com/CelestiaOrg',
        'https://discord.com/invite/YsnTPcSfWQ',
        'https://t.me/CelestiaCommunity',
      ],
    },
  },
  technology: {
    description: `
    ## Architecture
    
    ![Celestia architecture](/images/da-layer-technology/celestia/architecture.png#center)

    ## Consensus
    Celestia uses CometBTF, the canonical implementation of Tendermint consensus protocol. The consensus protocol is fork-free by construction under an honest majority of stake assumption.
    Celestia achieves finality at each block, with an average time between blocks of 12 seconds.
    ## Blobs
    In Celestia, blobs are user-submitted data that does not modify the blockchain state.  
    Each blob has two components, one is a binary object of raw data bytes, and the other is the namespace of the specific application for which the blob data is intended for.\n
    
    ![Blobs](/images/da-layer-technology/celestia/blobs.png#center)

    All data posted in a Celestia blob is divided into chunks of fixed size, called shares, and each blob is arranged in a k * k matrix of shares.\n

    ![Blobs matrix](/images/da-layer-technology/celestia/blobs-matrix.png#center)

    Celestia shares' rows and columns are erasure-coded into a 2k * 2k matrix and committed to in a Namespace Merkle Trees (NMTs), a version of a standard Merkle tree using a namespaced hash function. 
    In NMTs, every node in the tree includes the range of namespaces of all its child nodes, allowing applications to request and retrieve data for a specific namespace sub-tree while maintaining all functionalities (e.g., inclusion and range proofs) of a standard Merkle tree.\n

    ![Matrix proofs](/images/da-layer-technology/celestia/matrix-proofs.png#center)

    Ultimately, a single data root (availableDataRoot) of the Merkle tree is computed with the row and column roots as leaves. This data root is included in the block header as the root of commitments to erasure-coded data so that individual shares in the matrix can be proven to belong to a single data root.\n

    ![Data root](/images/da-layer-technology/celestia/data-root.png#center)

    ## Data Availability Sampling (DAS)

    To ensure data availability, Celestia light nodes perform sampling on the 2k x 2k data matrix. Each light node randomly selects a set of unique coordinates within the extended matrix and requests the corresponding data shares and Merkle proofs from full nodes.
    Currently, a Celestia light node must perform a minimum of 16 samples before declaring that a block is available.
    This sampling rate ensures that given the minimum number of unavailable shares, a light client will sample at least one unavailable share with a 99% probability.\n
    
    ![DAS](/images/da-layer-technology/celestia/das.png#center)

    ## Erasure Coding Proof
    Light nodes performing data availability sampling must have the guarantee that the sampled data is erasure coded correctly. In Celestia, light nodes can be notified of a maliciously encoded block through Bad Encoding Fraud Proofs (BEFPs). Full nodes receiving invalid erasure-coded data can generate a fraud-proof to be transmitted to all light and full nodes in the DA network. The proof is generated by full nodes reconstructing the original data from the block data, and verifying that the recomputed data root matches the data root of the block header. 
    Upon receiving and verifying the BEFP, all Celestia nodes should halt providing services (e.g., submitTx).

    ## L2s Data Availability
    Scaling solutions can post data to Celestia by submitting blobs through a payForBlobs transaction. The transaction can include data as a single blob or multiple blobs, with the total maximum size determined by the maximum block size. The transaction fee is determined by the size of the data and the current gas price. 
    Applications can then retrieve the data by querying the Celestia blockchain for the data root of the blob and the namespace of the application. The data can be reconstructed by querying the Celestia network for the shares of the data matrix and reconstructing the data using the erasure coding scheme.

    `,
  },
  bridges: [
    NO_BRIDGE({
      layer: 'Celestia',
      description:
        'The risk profile in this page refers to scaling solutions that do not integrate with a data availability bridge.',
      technology: {
        description: `No DA bridge is selected. Without a DA bridge, Ethereum has no proof of data availability for this project.\n`,
      },
    }),
    ...blobstream,
  ],
  usedIn: linkByDA({
    layer: (layer) => layer === 'Celestia',
  }),
  /*
    Node params sources:
    - unbondingPeriod, finality (time_iota_ms): https://celestiaorg.github.io/celestia-app/specs/params.html
    - pruningWindow: https://github.com/celestiaorg/CIPs/blob/main/cips/cip-4.md
    - block time: https://github.com/celestiaorg/celestia-app/blob/main/pkg/appconsts/consensus_consts.go
    - max block size: (DefaultMaxBytes) https://github.com/celestiaorg/celestia-app/blob/main/pkg/appconsts/initial_consts.go
  */
  consensusAlgorithm: {
    name: 'CometBFT',
    description: `CometBFT is the canonical implementation of the Tendermint consensus algorithm.
    CometBFT allows for a state transition machine to be written in any programming language, and it allows for secure replication across many machines.
    The consensus protocol is fork-free by construction under an honest majority of stake assumption.`,
    blockTime: 15, // goal block time, seconds
    consensusFinality: 1, // 1 second for tendermint, time_iota_ms
    unbondingPeriod: UnixTime.DAY * 21, // staking.UnbondingTime
  },
  dataAvailabilitySampling: {
    erasureCodingScheme: DasErasureCodingScheme.TwoDReedSolomon,
    erasureCodingProof: DasErasureCodingProof.FraudProofs,
  },
  pruningWindow: 86400 * 30, // 30 days in seconds
  risks: {
    economicSecurity: DaEconomicSecurityRisk.OnChainQuantifiable,
    fraudDetection: DaFraudDetectionRisk.DasWithNoBlobsReconstruction(true),
  },
  economicSecurity: {
    type: 'Celestia',
  },
}
