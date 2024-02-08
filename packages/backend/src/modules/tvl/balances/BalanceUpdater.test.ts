import { Logger } from '@l2beat/backend-tools'
import {
  AssetId,
  ChainId,
  CoingeckoId,
  EthereumAddress,
  ProjectId,
  Token,
  UnixTime,
} from '@l2beat/shared-pure'
import { expect, mockFn, mockObject } from 'earl'
import waitForExpect from 'wait-for-expect'

import { Clock } from '../../../tools/Clock'
import { BlockNumberUpdater } from '../BlockNumberUpdater'
import {
  BalanceRecord,
  BalanceRepository,
} from '../repositories/BalanceRepository'
import { BalanceStatusRepository } from '../repositories/BalanceStatusRepository'
import { BalanceProject } from './BalanceProject'
import { BalanceProvider } from './BalanceProvider'
import { BalanceUpdater, getMissingData } from './BalanceUpdater'
import { getBalanceConfigHash } from './getBalanceConfigHash'

describe(BalanceUpdater.name, () => {
  const chainId = ChainId.ETHEREUM

  describe(BalanceUpdater.prototype.start.name, () => {
    const NOW = UnixTime.now().toStartOf('hour')

    it('skips known timestamps', async () => {
      const clock = mockObject<Clock>({
        _TVL_ONLY_onEveryHour: (callback) => {
          callback(NOW.add(-1, 'hours'))
          callback(NOW)
          callback(NOW.add(1, 'hours'))
          callback(NOW.add(2, 'hours'))
          return () => {}
        },
      })

      const balanceStatusRepository = mockObject<BalanceStatusRepository>({
        getByConfigHash: async () => [NOW, NOW.add(1, 'hours')],
        add: async (x) =>
          `[chainId | ${x.chainId.toString()}]: ${x.configHash.toString()}`,
      })
      const balanceRepository = mockObject<BalanceRepository>({
        getByChainAndTimestamp: async () => [],
      })
      const balanceProvider = mockObject<BalanceProvider>({
        getChainId: () => chainId,
      })

      const balanceUpdater = new BalanceUpdater(
        balanceProvider,
        mockObject<BlockNumberUpdater>(),
        balanceRepository,
        balanceStatusRepository,
        clock,
        [],
        Logger.SILENT,
        chainId,
        new UnixTime(0),
      )

      await balanceUpdater.start()

      await waitForExpect(() => {
        expect(balanceStatusRepository.add).toHaveBeenCalledTimes(2)
        expect(balanceStatusRepository.add).toHaveBeenNthCalledWith(1, {
          configHash: getBalanceConfigHash([]),
          timestamp: NOW.add(2, 'hours'),
          chainId,
        })
        expect(balanceStatusRepository.add).toHaveBeenNthCalledWith(2, {
          configHash: getBalanceConfigHash([]),
          timestamp: NOW.add(-1, 'hours'),
          chainId,
        })
      })
    })
  })

  describe(BalanceUpdater.prototype.update.name, () => {
    it('fetches and saves missing datapoints', async () => {
      const blockNumber = 1234
      const holderAddress = EthereumAddress.random()
      const projects: BalanceProject[] = [
        {
          projectId: ProjectId('first'),
          escrows: [
            {
              address: holderAddress,
              sinceTimestamp: new UnixTime(1000),
              tokens: [
                fakeTokenInfo(AssetId('foo'), new UnixTime(1000)),
                fakeTokenInfo(AssetId('bar'), new UnixTime(1000)),
                fakeTokenInfo(AssetId('baz'), new UnixTime(1000)),
              ],
            },
          ],
        },
      ]

      const balanceRepository = mockObject<BalanceRepository>({
        getByChainAndTimestamp: async (chainId, timestamp) => [
          mockBalance(AssetId('baz'), timestamp, holderAddress, chainId),
        ],
        addMany: async () => 0,
      })
      const balanceStatusRepository = mockObject<BalanceStatusRepository>({
        add: async (x) =>
          `[chainId | ${x.chainId.toString()}]: ${x.configHash.toString()}`,
      })
      const balanceProvider = mockObject<BalanceProvider>({
        getChainId: () => chainId,
      })

      const blockNumberUpdater = mockObject<BlockNumberUpdater>({
        getBlockNumberWhenReady: async () => blockNumber,
      })

      const balanceUpdater = new BalanceUpdater(
        balanceProvider,
        blockNumberUpdater,
        balanceRepository,
        balanceStatusRepository,
        mockObject<Clock>(),
        projects,
        Logger.SILENT,
        chainId,
        new UnixTime(0),
      )

      const timestamp = new UnixTime(2000)
      const balances: BalanceRecord[] = [
        mockBalance(AssetId('foo'), timestamp, holderAddress, chainId),
        mockBalance(AssetId('bar'), timestamp, holderAddress, chainId),
      ]
      const fetchBalances =
        mockFn<typeof balanceProvider.fetchBalances>().resolvesTo(balances)
      balanceProvider.fetchBalances = fetchBalances

      await balanceUpdater.update(timestamp)
      expect(fetchBalances).toHaveBeenOnlyCalledWith(
        [
          { assetId: AssetId('foo'), holder: holderAddress },
          { assetId: AssetId('bar'), holder: holderAddress },
        ],
        timestamp,
        blockNumber,
      )
      expect(balanceRepository.addMany).toHaveBeenOnlyCalledWith(balances)
      expect(balanceStatusRepository.add).toHaveBeenOnlyCalledWith({
        configHash: getBalanceConfigHash(projects),
        timestamp,
        chainId,
      })
    })

    it('skips work if everything is known', async () => {
      const holderAddress = EthereumAddress.random()
      const projects: BalanceProject[] = [
        {
          projectId: ProjectId('first'),
          escrows: [
            {
              address: holderAddress,
              sinceTimestamp: new UnixTime(1000),
              tokens: [
                fakeTokenInfo(AssetId('foo'), new UnixTime(1000)),
                fakeTokenInfo(AssetId('bar'), new UnixTime(1000)),
                fakeTokenInfo(AssetId('baz'), new UnixTime(1000)),
              ],
            },
          ],
        },
      ]

      const balanceRepository = mockObject<BalanceRepository>({
        getByChainAndTimestamp: async (chainId, timestamp) => [
          mockBalance(AssetId('foo'), timestamp, holderAddress, chainId),
          mockBalance(AssetId('bar'), timestamp, holderAddress, chainId),
          mockBalance(AssetId('baz'), timestamp, holderAddress, chainId),
        ],
      })
      const balanceStatusRepository = mockObject<BalanceStatusRepository>({
        add: async (x) =>
          `[chainId | ${x.chainId.toString()}]: ${x.configHash.toString()}`,
      })
      const balanceProvider = mockObject<BalanceProvider>({
        getChainId: () => chainId,
      })
      const balanceUpdater = new BalanceUpdater(
        balanceProvider,
        mockObject<BlockNumberUpdater>(),
        balanceRepository,
        balanceStatusRepository,
        mockObject<Clock>(),
        projects,
        Logger.SILENT,
        chainId,
        new UnixTime(0),
      )

      const timestamp = new UnixTime(2000)

      await balanceUpdater.update(timestamp)
      expect(balanceStatusRepository.add).toHaveBeenOnlyCalledWith({
        configHash: getBalanceConfigHash(projects),
        timestamp,
        chainId,
      })
    })

    it('throws if timestamp < minTimestamp', async () => {
      const provider = mockObject<BalanceProvider>({
        getChainId: () => chainId,
        fetchBalances: async () => [],
      })

      const status = mockObject<BalanceStatusRepository>({
        add: async () => '',
      })
      const balanceUpdater = new BalanceUpdater(
        provider,
        mockObject<BlockNumberUpdater>(),
        mockObject<BalanceRepository>(),
        status,
        mockObject<Clock>(),
        [],
        Logger.SILENT,
        chainId,
        new UnixTime(1000),
      )

      await expect(
        async () => await balanceUpdater.update(new UnixTime(999)),
      ).toBeRejectedWith('Timestamp cannot be smaller than minTimestamp')

      expect(provider.fetchBalances).not.toHaveBeenCalled()
    })
  })

  describe(getMissingData.name, () => {
    it('returns queries to be made', () => {
      const timestamp = new UnixTime(2500)
      const escrow = EthereumAddress.random()
      const projects: BalanceProject[] = [
        {
          projectId: ProjectId('first'),
          escrows: [
            {
              address: escrow,
              sinceTimestamp: new UnixTime(2000),
              tokens: [
                fakeTokenInfo(AssetId.ETH, new UnixTime(1000)),
                fakeTokenInfo(AssetId('foo'), new UnixTime(1000)),
                fakeTokenInfo(AssetId('bar'), new UnixTime(1000)),
                fakeTokenInfo(AssetId('baz'), new UnixTime(1000)),
                fakeTokenInfo(AssetId.DAI, new UnixTime(3000)),
              ],
            },
            {
              address: EthereumAddress.random(),
              sinceTimestamp: new UnixTime(3000),
              tokens: [fakeTokenInfo(AssetId.ETH, new UnixTime(1000))],
            },
          ],
        },
      ]

      const known: BalanceRecord[] = [
        {
          timestamp,
          assetId: AssetId('bar'),
          holderAddress: escrow,
          balance: 1n,
          chainId: chainId,
        },
        {
          timestamp,
          assetId: AssetId('baz'),
          holderAddress: escrow,
          balance: 1n,
          chainId,
        },
      ]

      const result = getMissingData(timestamp, known, projects)
      expect(result).toEqual([
        { assetId: AssetId.ETH, holder: escrow },
        { assetId: AssetId('foo'), holder: escrow },
      ])
    })
  })

  function fakeTokenInfo(id: AssetId, sinceTimestamp: UnixTime): Token {
    return {
      id,
      sinceTimestamp,
      name: 'Fake',
      coingeckoId: CoingeckoId('fake-token'),
      symbol: 'FKT',
      decimals: 18,
      address: EthereumAddress.random(),
      category: 'other',
      chainId: ChainId.ETHEREUM,
      type: 'CBV',
      formula: 'locked',
    }
  }
})
function mockBalance(
  assetId: AssetId,
  timestamp: UnixTime,
  holderAddress: EthereumAddress,
  chainId: ChainId,
): BalanceRecord {
  return {
    assetId,
    timestamp,
    balance: 1n,
    holderAddress,
    chainId,
  }
}
