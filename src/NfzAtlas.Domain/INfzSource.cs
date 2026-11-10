using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public interface INfzSource
{
    Task<PageResult> FetchAsync(Partition partition, int page, CancellationToken cancellationToken);
}
