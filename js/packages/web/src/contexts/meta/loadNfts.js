import {
  AUCTION_ID,
  METADATA_PROGRAM_ID,
  METAPLEX_ID,
  StringPublicKey,
  toPublicKey,
  VAULT_ID,
  TOKEN_PROGRAM_ID,
} from '@oyster/common/dist/lib/utils/ids';
import * as web3 from '@solana/web3.js';

const METADATA_PROGRAM_ID_PUBLIC_KEY = new web3.PublicKey(METADATA_PROGRAM_ID);

export const getAllCollectibles = async (connection, wallets) => {
  const tokenAccountsByOwnerAddress = await Promise.all(
    wallets.map(async address =>
      connection.getParsedTokenAccountsByOwner(new web3.PublicKey(address), {
        programId: TOKEN_PROGRAM_ID,
      }),
    ),
  );

  const potentialNFTsByOwnerAddress = tokenAccountsByOwnerAddress
    .map(ta => ta.value)
    // value is an array of parsed token info
    .map((value, i) => {
      const mintAddresses = value
        .map(v => ({
          mint: v.account.data.parsed.info.mint,
          tokenAmount: v.account.data.parsed.info.tokenAmount,
        }))
        .filter(({ tokenAmount }) => {
          // Filter out the token if we don't have any balance
          const ownsNFT = tokenAmount.amount !== '0';
          // Filter out the tokens that don't have 0 decimal places.
          // NFTs really should have 0
          const hasNoDecimals = tokenAmount.decimals === 0;
          return ownsNFT && hasNoDecimals;
        })
        .map(({ mint }) => mint);
      return { mintAddresses };
    });

  const nfts = await Promise.all(
    potentialNFTsByOwnerAddress.map(async ({ mintAddresses }) => {
      const programAddresses = await Promise.all(
        mintAddresses.map(
          async mintAddress =>
            (
              await web3.PublicKey.findProgramAddress(
                [
                  Buffer.from('metadata'),
                  METADATA_PROGRAM_ID_PUBLIC_KEY.toBytes(),
                  new web3.PublicKey(mintAddress).toBytes(),
                ],
                METADATA_PROGRAM_ID_PUBLIC_KEY,
              )
            )[0],
        ),
      );
      const accountInfos = await Promise.all(
        programAddresses.map(async item => {
          const data = await connection.getAccountInfo(item);
          return {
            account: {
              data: data.data,
              executable: data.executable,
              lamports: data.lamports,
              // TODO: maybe we can do it in lazy way? or just use string
              owner: data.owner,
            },
            pubkey: item,
          };
        }),
      );
      console.log('accountInfos', accountInfos);
      return accountInfos;

      //   const nonNullInfos = accountInfos?.filter(Boolean) ?? [];

      //   const metadataUrls = nonNullInfos
      //     .map(x => _utf8ArrayToNFTType(x.data))
      //     .filter(Boolean);

      //   const results = await Promise.all(
      //     metadataUrls.map(async item =>
      //       fetch(item.url)
      //         .then(res => res.json())
      //         .catch(() => null),
      //     ),
      //   );

      //   const metadatas = results.map((metadata, i) => ({
      //     metadata,
      //     type: metadataUrls[i].type,
      //   }));
      // return metadatas.filter((r) => !!r.metadata);
    }),
  );
  return nfts;
};
